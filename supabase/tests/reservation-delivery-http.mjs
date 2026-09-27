import { randomUUID } from "node:crypto";

// Called only by the schema-verified loopback Docker harness. Every application
// mutation below uses a real authenticated HTTP request; SQL seeds slots and
// historical fixtures or holds a transaction to exercise lock ordering.
export async function runReservationDelivery({
  rpc,
  request,
  restURL,
  token,
  users,
  org,
  sql,
  sqlAsync,
  check,
}) {
  const serviceArgs = {
    p_org: org,
    p_id: null,
    p_name: "Reservation delivery regression",
    p_minutes: 45,
    p_price: 155,
    p_active: true,
    p_category: null,
    p_subcategory: null,
    p_pricing_mode: "fixed",
    p_buffer: 0,
    p_delivery: "both",
  };
  const created = await rpc("owner", "glam_save_catalog_service_with_delivery", serviceArgs);
  check(created.status === 200, "reservation fixture service created through checked RPC");
  const service = created.data;
  const setMode = async (mode) => {
    const r = await rpc("owner", "glam_save_catalog_service_with_delivery", {
      ...serviceArgs,
      p_id: service,
      p_delivery: mode,
    });
    check(r.status === 200, "owner sets reservation channels: " + mode);
  };
  const slots = Array.from({ length: 22 }, () => randomUUID());
  sql(`insert into public.glam_service_specialists(service_id,specialist_id) values ('${service}','${users.specialist.id}');
    insert into public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at) values ('${org}','${users.specialist.id}','shift',date_trunc('day',now())+interval '8 days',date_trunc('day',now())+interval '10 days');`);
  for (let i = 0; i < slots.length; i++)
    sql(`insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
    select '${slots[i]}','${org}','${users.specialist.id}','RPC review','Test',name,date_trunc('day',now())+interval '8 days ${i + 1} hours',date_trunc('day',now())+interval '8 days ${i + 1} hours 45 minutes',price_sar,id,revision from public.glam_services where id='${service}';`);
  const reserve = (i, channel, requestId = randomUUID(), role = "customer") =>
    rpc(role, "glam_reserve", {
      p_appointment: slots[i],
      p_request: requestId,
      ...(channel === undefined ? {} : { p_channel: channel }),
    });
  const direct = (i, channel, requestId = randomUUID()) =>
    rpc("customer", "glam_reserve_direct", {
      p_slug: `http-${org}`,
      p_appointment: slots[i],
      p_request: requestId,
      ...(channel === undefined ? {} : { p_channel: channel }),
    });
  const move = (id, i, channel, requestId = randomUUID(), role = "customer") =>
    rpc(role, "glam_reschedule", {
      p_id: id,
      p_appointment: slots[i],
      p_request: requestId,
      ...(channel === undefined ? {} : { p_channel: channel }),
    });
  const row = (id) =>
    JSON.parse(
      sql(
        `select row_to_json(r) from (select status,delivery_channel,replaces_reservation_id,booking_source from public.glam_reservations where id='${id}') r;`,
      ).trim(),
    );
  const required = await direct(0, undefined);
  check(
    required.status === 400 && required.data.message === "DELIVERY_REQUIRED",
    "legacy RPC with two channels requires an explicit choice",
  );
  const key = randomUUID();
  const first = await direct(0, "home", key);
  check(
    first.status === 200 &&
      row(first.data).delivery_channel === "home" &&
      row(first.data).booking_source === "salon_link",
    "reserve_direct persists chosen home channel and source",
  );
  await setMode("salon");
  const replay = await direct(0, "home", key);
  check(
    replay.status === 200 && replay.data === first.data,
    "idempotent replay preserves booking after channel deactivation",
  );
  check(
    (await direct(0, "salon", key)).data.message === "REQUEST_MISMATCH",
    "same request cannot change a booked channel",
  );
  const refused = await move(first.data, 1, undefined);
  check(
    refused.status === 400 &&
      refused.data.message === "DELIVERY_UNAVAILABLE" &&
      row(first.data).status === "confirmed",
    "reschedule preserves original channel and rolls cancellation back when disabled",
  );
  const moveKey = randomUUID();
  const moved = await move(first.data, 1, "salon", moveKey);
  check(
    moved.status === 200 &&
      row(moved.data).delivery_channel === "salon" &&
      row(moved.data).booking_source === "salon_link" &&
      row(moved.data).replaces_reservation_id === first.data,
    "explicit reschedule chooses valid new channel and preserves lineage/source",
  );
  check(
    row(first.data).status === "cancelled" && row(first.data).delivery_channel === "home",
    "reschedule retains historical channel unchanged",
  );
  check(
    (await move(first.data, 1, "salon", moveKey)).data === moved.data,
    "reschedule replay returns the same replacement",
  );
  check(
    (await move(moved.data, 2, "salon", randomUUID(), "ownerB")).data.message === "NOT_FOUND",
    "other account cannot reschedule a customer's reservation",
  );
  const legacy = await direct(2, undefined);
  check(
    legacy.status === 200 && row(legacy.data).delivery_channel === "salon",
    "old reserve_direct signature resolves a single configured channel",
  );
  const oldMoveKey = randomUUID();
  const legacyMove = await move(legacy.data, 3, undefined, oldMoveKey);
  check(
    legacyMove.status === 200 &&
      row(legacyMove.data).delivery_channel === "salon" &&
      (await move(legacy.data, 3, undefined, oldMoveKey)).data === legacyMove.data,
    "old reschedule signature preserves channel and idempotency",
  );
  const historical = await reserve(4, undefined);
  check(historical.status === 200, "old reserve signature remains callable");
  // Reproduce a pre-column historical row without changing the live database.
  sql(`alter table public.glam_reservations disable trigger glam_delivery_booking;
    update public.glam_reservations set delivery_channel=null where id='${historical.data}';
    alter table public.glam_reservations enable trigger glam_delivery_booking;`);
  await setMode("both");
  const ambiguous = await move(historical.data, 5, undefined);
  check(
    ambiguous.data.message === "DELIVERY_REQUIRED" && row(historical.data).status === "confirmed",
    "unknown historical channel is not guessed and failed reschedule is atomic",
  );
  const clarified = await move(historical.data, 5, "home");
  check(
    clarified.status === 200 &&
      row(historical.data).delivery_channel === null &&
      row(clarified.data).delivery_channel === "home",
    "explicit reschedule works for historical NULL without backfilling history",
  );
  const invalid = await reserve(6, "invalid");
  sql(`select set_config('request.jwt.claim.sub','${users.customer.id}',false);
    do $$ begin
      begin
        update public.glam_reservations set status='confirmed' where id='${historical.data}';
        raise exception 'historical NULL reactivation accepted' using errcode='ZX007';
      exception when invalid_parameter_value then
        if sqlerrm<>'DELIVERY_REQUIRED' then raise; end if;
      end;
    end $$;`);
  check(
    row(historical.data).status === "cancelled" && row(historical.data).delivery_channel === null,
    "status-only reactivation cannot backfill a historical NULL channel",
  );
  check(
    invalid.status === 400 && invalid.data.message === "DELIVERY_UNAVAILABLE",
    "RPC rejects invalid channel",
  );
  check(
    [401, 403].includes((await reserve(6, "salon", randomUUID(), "anon")).status),
    "anonymous caller cannot invoke channel-aware reserve",
  );
  const sameKey = randomUUID();
  sql(`begin isolation level repeatable read;
    select set_config('request.jwt.claim.sub','${users.customer.id}',true);
    do $$ begin
      begin
        perform public.glam_reserve('${slots[21]}','${randomUUID()}','salon');
        raise exception 'stale snapshot writer accepted' using errcode='ZX008';
      exception when raise_exception then
        if sqlerrm<>'BOOKING_ISOLATION_UNSUPPORTED' then raise; end if;
      end;
    end $$;rollback;`);
  check(true, "snapshot-isolated writers fail closed instead of reading stale overlap state");
  const simultaneous = await Promise.all([
    reserve(6, "salon", sameKey),
    reserve(6, "salon", sameKey),
  ]);
  check(
    simultaneous.every((r) => r.status === 200) && simultaneous[0].data === simultaneous[1].data,
    "concurrent identical RPCs yield one idempotent reservation",
  );
  const conflictingKey = randomUUID();
  const conflicting = await Promise.all([
    reserve(7, "salon", conflictingKey),
    reserve(8, "home", conflictingKey),
  ]);
  check(
    conflicting.filter((r) => r.status === 200).length === 1 &&
      conflicting.some((r) => r.data.message === "REQUEST_MISMATCH"),
    "concurrent reuse of request id for different bookings rejects mismatch",
  );
  async function overlap(i, mixed) {
    const overlapping = randomUUID();
    sql(`insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
      select '${overlapping}',organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at+interval '15 minutes',ends_at+interval '15 minutes',price_sar,service_id,service_revision from public.glam_appointments where id='${slots[i]}';`);
    const insert = (appointment) =>
      request(restURL, "/glam_reservations", token("customer"), "POST", {
        appointment_id: appointment,
        customer_id: users.customer.id,
        request_id: randomUUID(),
        booking_source: "salon_link",
        delivery_channel: "salon",
      });
    const results = await Promise.all([
      mixed ? reserve(i, "salon") : insert(slots[i]),
      insert(overlapping),
    ]);
    check(
      results.filter((r) => r.status === 200 || r.status === 201).length === 1 &&
        results.some((r) => r.data.message === "SLOT_TAKEN"),
      (mixed ? "mixed RPC/REST" : "direct REST") +
        " concurrent overlapping slots permit only one booking",
    );
  }
  await overlap(9, false);
  await overlap(10, true);
  const rescheduleOrigin = await reserve(11, "home");
  const simultaneousMoves = await Promise.all([
    move(rescheduleOrigin.data, 12, undefined),
    move(rescheduleOrigin.data, 13, undefined),
  ]);
  check(
    simultaneousMoves.filter((r) => r.status === 200).length === 1 &&
      simultaneousMoves.some((r) => r.data.message === "NOT_CONFIRMED"),
    "concurrent reschedules produce exactly one replacement",
  );
  check(
    sql(
      `select count(*) from public.glam_reservations where replaces_reservation_id='${rescheduleOrigin.data}';`,
    ).trim() === "1",
    "reschedule race preserves a single lineage",
  );
  async function sleeping(marker) {
    for (let i = 0; i < 60; i++) {
      if (
        sql(
          `select count(*) from pg_stat_activity where application_name='${marker}' and wait_event='PgSleep';`,
        ).trim() === "1"
      )
        return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error("Test transaction did not acquire its locks");
  }
  function modeSQL(mode, price = 155) {
    return `select public.glam_save_catalog_service_with_delivery('${org}','${service}','Reservation delivery regression',45,${price},true,null,null,'fixed',0,'${mode}');`;
  }
  async function hold(query, user) {
    const marker = "pr4_" + randomUUID().replaceAll("-", "");
    const pending = sqlAsync(
      `begin;set local application_name='${marker}';select set_config('request.jwt.claim.sub','${user}',true);${query}select pg_sleep(3);commit;`,
    );
    await sleeping(marker);
    return { pending };
  }
  const changing = await hold(modeSQL("home"), users.owner.id);
  const staleChannel = await reserve(14, "salon");
  await changing.pending;
  check(
    staleChannel.data.message === "DELIVERY_UNAVAILABLE",
    "booking waits for concurrent settings save and checks committed channel",
  );
  const bookedFirst = await hold(
    `select public.glam_reserve('${slots[15]}','${randomUUID()}','home');`,
    users.customer.id,
  );
  const updateAfter = await rpc("owner", "glam_save_catalog_service_with_delivery", {
    ...serviceArgs,
    p_id: service,
    p_delivery: "salon",
  });
  await bookedFirst.pending;
  check(
    updateAfter.status === 200 &&
      sql(
        `select delivery_channel from public.glam_reservations where appointment_id='${slots[15]}' and status='confirmed';`,
      ).trim() === "home",
    "settings save waits for booking; existing home reservation remains intact",
  );
  const priceChange = await hold(modeSQL("salon", 156), users.owner.id);
  const staleRevision = await reserve(16, "salon");
  await priceChange.pending;
  check(
    staleRevision.data.message === "SERVICE_UNAVAILABLE",
    "concurrent price change invalidates stale appointment revision before booking",
  );
  check(
    sql(
      `select count(*) from public.glam_reservations where appointment_id in ('${slots[14]}','${slots[16]}');`,
    ).trim() === "0",
    "rejected concurrent channel/revision requests leave no reservation",
  );
}

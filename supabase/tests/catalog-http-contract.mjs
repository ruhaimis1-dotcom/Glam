import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadBookingCatalog } from "../../src/repositories/booking-catalog.ts";
import { createCatalogRepository } from "../../src/repositories/service-intelligence.ts";

export async function runContract({ authURL, restURL, anon, admin, expired, sql }) {
  let passed = 0;
  const checks = [];
  function check(ok, label) {
    assert.ok(ok, label);
    passed++;
    checks.push(label);
    console.log(`PASS ${label}`);
  }
  async function request(base, path, token, method = "GET", body, headers = {}) {
    assert.equal(new URL(base).hostname, "127.0.0.1");
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(15000),
      method,
      headers: {
        apikey: anon,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data };
  }
  const users = {};
  for (const role of ["owner", "manager", "specialist", "customer", "ownerB"]) {
    const email = `${role.toLowerCase()}-${randomUUID()}@example.test`,
      password = randomBytes(24).toString("hex");
    const created = await request(authURL, "/admin/users", admin, "POST", {
      email,
      password,
      email_confirm: true,
    });
    check(created.status === 200, `Auth creates ${role}`);
    const login = await request(authURL, "/token?grant_type=password", null, "POST", {
      email,
      password,
    });
    check(login.status === 200 && !!login.data.access_token, `password login ${role}`);
    users[role] = {
      id: login.data.user.id,
      token: login.data.access_token,
      refresh: login.data.refresh_token,
      email,
      password,
    };
  }
  const org = randomUUID(),
    other = randomUUID();
  sql(`insert into public.glam_organizations(id,name,status) values ('${org}','HTTP Salon A','active'),('${other}','HTTP Salon B','active');
    insert into public.glam_memberships(organization_id,user_id,role) values
    ('${org}','${users.owner.id}','owner'),('${org}','${users.manager.id}','manager'),
    ('${org}','${users.specialist.id}','specialist'),('${other}','${users.ownerB.id}','owner');
    insert into public.glam_salon_pages(organization_id,slug,title,published) values
    ('${org}','http-${org}','HTTP Salon A',true),('${other}','http-${other}','HTTP Salon B',false);`);
  const token = (role) => users[role]?.token ?? (role === "anon" ? anon : role);
  const rpc = (role, name, body) => request(restURL, `/rpc/${name}`, token(role), "POST", body);
  const clients = {};
  for (const role of ["owner", "manager", "customer", "ownerB"]) {
    const client = createClient(authURL.replace(/\/auth\/v1$/, ""), anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const session = await client.auth.setSession({
      access_token: users[role].token,
      refresh_token: users[role].refresh,
    });
    check(
      !session.error && session.data.user?.id === users[role].id,
      `${role} SDK verifies actual Auth session`,
    );
    clients[role] = client;
  }
  const read = (role, table, filter = "") =>
    request(restURL, `/${table}?select=*&${filter}`, token(role));
  const service = (overrides = {}) => ({
    p_org: org,
    p_id: null,
    p_name: "HTTP service",
    p_minutes: 45,
    p_price: 100,
    p_active: true,
    p_category: null,
    p_subcategory: null,
    p_pricing_mode: "fixed",
    p_buffer: 0,
    ...overrides,
  });
  async function saved(role, body) {
    const r = await rpc(role, "glam_save_catalog_service", body);
    check(r.status === 200 && typeof r.data === "string", `${role} saves ${body.p_name}`);
    return r.data;
  }
  const category = await rpc("owner", "glam_save_catalog_category", {
    p_org: org,
    p_id: null,
    p_name: "HTTP category",
    p_parent: null,
  });
  check(category.status === 200, "owner creates category via RPC");
  const subcategory = await rpc("manager", "glam_save_catalog_category", {
    p_org: org,
    p_id: null,
    p_name: "HTTP subcategory",
    p_parent: category.data,
  });
  check(subcategory.status === 200, "manager creates subcategory via RPC");
  const sid = await saved(
    "owner",
    service({ p_category: category.data, p_subcategory: subcategory.data }),
  );
  const original = (await read("owner", "glam_services", `id=eq.${sid}`)).data[0];
  check(
    original?.price_sar === 100 && original.active,
    "create persisted via independent REST read",
  );
  await saved(
    "manager",
    service({
      p_id: sid,
      p_name: "Edited service",
      p_price: 150,
      p_category: category.data,
      p_subcategory: subcategory.data,
    }),
  );
  let edited = (await read("owner", "glam_services", `id=eq.${sid}`)).data[0];
  check(
    edited?.name === "Edited service" &&
      edited.price_sar === 150 &&
      edited.revision === original.revision + 1,
    "manager edit persisted and revision increments",
  );
  const repository = createCatalogRepository(clients.owner);
  check(
    (await repository.load(org)).services.some((s) => s.id === sid),
    "actual catalog repository loads using Auth and REST",
  );
  await assert.rejects(() => createCatalogRepository(clients.ownerB).load(org), /FORBIDDEN/);
  check(true, "actual repository rejects another salon");
  const repoService = await repository.saveService(org, null, {
    name: "SDK service",
    minutes: 30,
    price_sar: 50,
    active: true,
    category_id: null,
    subcategory_id: null,
    pricing_mode: "fixed",
    buffer_minutes: 0,
  });
  await createCatalogRepository(clients.manager).saveService(org, repoService, {
    name: "SDK archived",
    minutes: 30,
    price_sar: 50,
    active: false,
    category_id: null,
    subcategory_id: null,
    pricing_mode: "fixed",
    buffer_minutes: 0,
  });
  check(
    (await repository.load(org)).services.some((s) => s.id === repoService && !s.active),
    "actual repository creates and archives service",
  );
  await repository.deleteService(org, repoService);
  check(
    !(await repository.load(org)).services.some((s) => s.id === repoService),
    "actual repository deletes service",
  );
  const draft = await saved("manager", service({ p_name: "Manager draft", p_active: false }));
  check(
    (await read("customer", "glam_services", `id=eq.${draft}`)).data.length === 0,
    "customer cannot read inactive service",
  );
  check(
    (await read("owner", "glam_services", `id=eq.${draft}`)).data.length === 1,
    "owner reads inactive service",
  );
  const removed = await rpc("manager", "glam_delete_catalog_service", { p_org: org, p_id: draft });
  check(
    removed.status === 200 &&
      removed.data === draft &&
      (await read("owner", "glam_services", `id=eq.${draft}`)).data.length === 0,
    "manager hard delete persisted",
  );
  const hidden = await saved("ownerB", service({ p_org: other, p_name: "Private B" }));
  for (const role of ["owner", "manager", "specialist", "customer", "anon"]) {
    const r = await read(role, "glam_services", `id=eq.${hidden}`);
    check(r.status === 200 && r.data.length === 0, `${role} cannot read unpublished B catalog`);
  }
  for (const role of ["specialist", "customer", "anon", "ownerB"]) {
    for (const args of [
      service({ p_name: "Unauthorized new" }),
      service({ p_id: sid, p_name: "Unauthorized edit" }),
    ]) {
      const r = await rpc(role, "glam_save_catalog_service", args);
      check([401, 403].includes(r.status), `${role} denied ${args.p_id ? "update" : "create"}`);
    }
    const del = await rpc(role, "glam_delete_catalog_service", { p_org: org, p_id: sid });
    check([401, 403].includes(del.status), `${role} denied delete`);
    const cat = await rpc(role, "glam_save_catalog_category", {
      p_org: org,
      p_id: category.data,
      p_name: "Unauthorized",
      p_parent: null,
    });
    check([401, 403].includes(cat.status), `${role} denied category write`);
  }
  check(
    (await read("owner", "glam_services", `id=eq.${sid}`)).data[0].name === edited.name &&
      sql(`select count(*) from public.glam_services where name like 'Unauthorized%';`).trim() ===
        "0",
    "denials leave database unchanged",
  );
  check(
    (await rpc("ownerB", "glam_save_catalog_service", service({ p_org: other, p_id: sid })))
      .status === 403,
    "forged service ID cannot cross organizations",
  );
  const wrongCategory = await rpc(
    "ownerB",
    "glam_save_catalog_service",
    service({ p_org: other, p_id: hidden, p_category: category.data }),
  );
  check(
    wrongCategory.status === 409 && wrongCategory.data.code === "23503",
    `cross-tenant category rejected (HTTP ${wrongCategory.status}, ${wrongCategory.data.code}: ${wrongCategory.data.message})`,
  );
  const badInput = await rpc(
    "owner",
    "glam_save_catalog_service",
    service({ p_id: sid, p_minutes: 1 }),
  );
  check(
    badInput.status >= 400 && badInput.data.code === "23514",
    "invalid duration rejected by database constraint",
  );
  const linked = await rpc("owner", "glam_delete_catalog_category", {
    p_org: org,
    p_id: category.data,
    p_subcategory: false,
  });
  check(linked.status === 409, "linked category cannot be deleted");
  for (const role of ["owner", "manager", "specialist", "customer", "anon"]) {
    const direct = await request(restURL, `/glam_services?id=eq.${sid}`, token(role), "PATCH", {
      price_sar: 999,
    });
    check([401, 403].includes(direct.status), `${role} direct write cannot bypass RPC`);
  }
  for (const invalid of [null, "invalid.jwt.token", expired]) {
    const r = await rpc(invalid, "glam_save_catalog_service", service());
    check(r.status === 401, "missing/invalid/expired token rejects protected write");
  }
  const privateSchema = await request(
    restURL,
    "/rpc/catalog_service_bookable",
    token("customer"),
    "POST",
    { p_service: sid },
    { "Content-Profile": "glam_private" },
  );
  check(privateSchema.status === 406, "glam_private not exposed in REST");
  for (const role of ["owner", "manager", "specialist", "customer", "ownerB", "anon"]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const r = await request(
        restURL,
        `/glam_service_delivery_options?service_id=eq.${sid}`,
        token(role),
        method,
        method === "POST"
          ? { organization_id: org, service_id: sid, channel: "salon" }
          : method === "PATCH"
            ? { enabled: false }
            : undefined,
      );
      check([401, 403].includes(r.status), `${role} delivery ${method} remains denied`);
    }
  }
  const a = randomUUID();
  sql(`insert into public.glam_service_specialists(service_id,specialist_id) values ('${sid}','${users.specialist.id}');
    insert into public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at)
    values ('${org}','${users.specialist.id}','shift',date_trunc('day',now())+interval '2 days 12 hours',date_trunc('day',now())+interval '2 days 20 hours');
    insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
    select '${a}','${org}','${users.specialist.id}','HTTP Salon A','HTTP specialist',name,
    date_trunc('day',now())+interval '2 days 12 hours',date_trunc('day',now())+interval '2 days 12 hours 45 minutes',price_sar,id,revision from public.glam_services where id='${sid}';`);
  const embedding =
    "id,name,price_sar,minutes,active,category_id,glam_service_categories!glam_services_category_id_fkey(name),glam_service_variants!glam_service_variants_service_id_fkey(id,name,price_sar,minutes,active)";
  const embed = await request(
    restURL,
    `/glam_services?select=${embedding}&id=eq.${sid}`,
    token("customer"),
  );
  check(
    embed.status === 200 && embed.data[0]?.glam_service_categories?.name === "HTTP category",
    "booking repository exact embedding resolves composite FKs",
  );
  const bookingBody = () => ({
    appointment_id: a,
    customer_id: users.customer.id,
    request_id: randomUUID(),
    booking_source: "salon_link",
  });
  async function visible(expected, label) {
    const catalog = await loadBookingCatalog(clients.customer, "HTTP Salon A");
    check(
      catalog.catalog.some((s) => s.id === sid) === expected &&
        catalog.appointments.some((s) => s.id === a) === expected,
      `${label}: actual booking repository`,
    );
    for (const role of ["customer", "anon"]) {
      const s = await read(role, "glam_services", `id=eq.${sid}`);
      check(
        s.status === 200 && (s.data.length === 1) === expected,
        `${label}: ${role} REST service visibility`,
      );
      const page = await rpc(role, "glam_salon_page", { p_slug: `http-${org}` });
      check(
        page.status === 200 && page.data.services.some((s) => s.id === sid) === expected,
        `${label}: ${role} salon page`,
      );
      const slots = await rpc(role, "glam_salon_slots", { p_slug: `http-${org}` });
      check(
        slots.status === 200 && slots.data.some((s) => s.id === a) === expected,
        `${label}: ${role} salon slots`,
      );
    }
    const available = await rpc("customer", "glam_available_appointments", {});
    check(
      available.status === 200 && available.data.some((s) => s.id === a) === expected,
      `${label}: customer available appointments`,
    );
  }
  await visible(true, "active");
  for (const [table, cid] of [
    ["glam_service_categories", category.data],
    ["glam_service_subcategories", subcategory.data],
  ]) {
    sql(`update public.${table} set active=false where id='${cid}';`);
    if (table === "glam_service_categories") {
      check(
        (await read("customer", "glam_service_subcategories", `id=eq.${subcategory.data}`)).data
          .length === 0,
        "inactive parent hides still-active subcategory",
      );
    }
    await visible(false, table);
    check(
      (await read("customer", table, `id=eq.${cid}`)).data.length === 0,
      `${table}: customer hides inactive classification`,
    );
    check(
      (await read("manager", table, `id=eq.${cid}`)).data.length === 1,
      `${table}: manager retains classification`,
    );
    check(
      sql(`select active from public.glam_services where id='${sid}';`).trim() === "t",
      `${table}: service remains active`,
    );
    const denied = await request(
      restURL,
      "/glam_reservations",
      token("customer"),
      "POST",
      bookingBody(),
    );
    check(
      denied.status === 400 && denied.data.message === "SERVICE_UNAVAILABLE",
      `${table}: direct booking trigger rejects`,
    );
    sql(`update public.${table} set active=true where id='${cid}';`);
    await visible(true, `${table} reactivated`);
  }
  await saved(
    "owner",
    service({
      p_id: sid,
      p_name: "Archived",
      p_active: false,
      p_category: category.data,
      p_subcategory: subcategory.data,
    }),
  );
  await visible(false, "archived service");
  await saved(
    "owner",
    service({
      p_id: sid,
      p_name: "Reactivated",
      p_category: category.data,
      p_subcategory: subcategory.data,
    }),
  );
  const stale = await request(
    restURL,
    "/glam_reservations",
    token("customer"),
    "POST",
    bookingBody(),
  );
  check(
    stale.status === 400 && stale.data.message === "SERVICE_UNAVAILABLE",
    "stale appointment revision rejects booking",
  );
  sql(
    `update public.glam_appointments set service_revision=(select revision from public.glam_services where id='${sid}') where id='${a}';`,
  );
  const booking = await request(
    restURL,
    "/glam_reservations",
    token("customer"),
    "POST",
    bookingBody(),
    { Prefer: "return=representation" },
  );
  check(
    booking.status === 201 && booking.data[0]?.appointment_id === a,
    "real customer HTTP booking succeeds",
  );
  const duplicate = await request(
    restURL,
    "/glam_reservations",
    token("customer"),
    "POST",
    bookingBody(),
  );
  check(duplicate.status >= 400 && duplicate.status < 500, "duplicate booking rejected");
  sql(`update public.glam_service_categories set active=false where id='${category.data}';`);
  check(
    (await read("customer", "glam_reservations", `appointment_id=eq.${a}`)).data.length === 1,
    "deactivation preserves customer booking history",
  );
  check(
    (await read("manager", "glam_appointments", `id=eq.${a}`)).data.length === 1,
    "deactivation preserves staff schedule",
  );
  sql(
    `delete from public.glam_memberships where organization_id='${org}' and user_id='${users.manager.id}';`,
  );
  check(
    (await rpc("manager", "glam_save_catalog_service", service())).status === 403,
    "revoked manager denied using original JWT",
  );
  await assert.rejects(() => createCatalogRepository(clients.manager).load(org), /FORBIDDEN/);
  check(true, "repository rejects revoked manager without token refresh");
  const refresh = await request(authURL, "/token?grant_type=refresh_token", null, "POST", {
    refresh_token: users.customer.refresh,
  });
  check(refresh.status === 200 && !!refresh.data.access_token, "real Auth refresh succeeds");
  const logout = await request(authURL, "/logout?scope=global", refresh.data.access_token, "POST");
  check(logout.status === 204, "Auth logout succeeds");
  const revoked = await request(authURL, "/token?grant_type=refresh_token", null, "POST", {
    refresh_token: refresh.data.refresh_token,
  });
  check(revoked.status === 400, "logout revokes refresh token");
  // Access JWTs may remain valid until expiry; do not assert immediate JWT revocation.
  const wrongPassword = await request(authURL, "/token?grant_type=password", null, "POST", {
    email: users.owner.email,
    password: "deliberately-wrong",
  });
  check(wrongPassword.status === 400, "wrong password rejected");
  return { passed, checks };
}

// Local-only recovery rehearsal. Never accepts a database URL or credentials.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const docker =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin/docker.exe")
    : "docker";
const container = "glam-pr4-review";
const prefix = "pr4_recovery_" + Date.now();
const dir = path.resolve("supabase/.temp", prefix);
fs.mkdirSync(dir, { recursive: true });
function run(args, input) {
  const r = spawnSync(docker, args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw Error(r.stderr || r.error?.message || "Docker failed");
  return r.stdout.trim();
}
if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw Error("Docker overrides refused");
const context = JSON.parse(run(["context", "inspect"]))[0];
assert.match(context.Endpoints.docker.Host, /^(npipe:|unix:)/);
const info = JSON.parse(run(["inspect", container]))[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0);
assert.equal(info.Config.Image, "public.ecr.aws/supabase/postgres:17.6.1.166");
assert.equal(info.State.Running, true);
const snapshot = path.resolve("supabase/.temp/glam-schema-only.sql");
assert.equal(
  crypto.createHash("sha256").update(fs.readFileSync(snapshot)).digest("hex"),
  "390756903381b1e8da2dcee4ab5b6cf9bcd32419e2d424c601b4a0d2b525d91e",
);
const migrations = [
  "20260925205817_catalog_contract_and_visibility.sql",
  "20260926150009_booking_catalog_visibility.sql",
  "20260927141701_catalog_delivery_booking.sql",
  "20260927155514_reservation_delivery_compatibility.sql",
];
const timing = [];
function timed(label, fn) {
  const start = performance.now();
  const result = fn();
  timing.push({ label, ms: Math.round(performance.now() - start) });
  return result;
}
function sql(db, query) {
  assert.match(db, /^pr4_recovery_\d+_[a-z]+$/);
  return run(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "supabase_admin",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    query,
  );
}
function create(suffix) {
  const db = prefix + "_" + suffix;
  run([
    "exec",
    container,
    "createdb",
    "-U",
    "supabase_admin",
    "-O",
    "postgres",
    "-T",
    "template0",
    db,
  ]);
  return db;
}
function apply(db, index) {
  timed("migration " + (index + 1) + " " + db, () =>
    sql(db, fs.readFileSync("supabase/migrations/" + migrations[index], "utf8")),
  );
}
function backup(db, name) {
  const file = "/tmp/" + prefix + "_" + name + ".dump";
  timed("backup " + name, () =>
    run(["exec", container, "pg_dump", "-U", "supabase_admin", "-Fc", "-f", file, db]),
  );
  run(["cp", container + ":" + file, path.join(dir, name + ".dump")]);
  return file;
}
function restore(file, suffix) {
  const db = create(suffix);
  timed("restore " + suffix, () =>
    run([
      "exec",
      container,
      "pg_restore",
      "-U",
      "supabase_admin",
      "--exit-on-error",
      "--single-transaction",
      "-d",
      db,
      file,
    ]),
  );
  return db;
}
const source = create("source");
timed("baseline schema restore", () => sql(source, fs.readFileSync(snapshot, "utf8")));
const ids = Object.fromEntries(
  ["customer", "specialist", "org", "service", "a", "b", "c"].map((k) => [k, crypto.randomUUID()]),
);
sql(
  source,
  `INSERT INTO auth.users(id) VALUES('${ids.customer}'),('${ids.specialist}');
INSERT INTO public.glam_organizations(id,name,status) VALUES('${ids.org}','Recovery synthetic salon','active');
INSERT INTO public.glam_memberships(organization_id,user_id,role) VALUES('${ids.org}','${ids.specialist}','specialist');
INSERT INTO public.glam_services(id,organization_id,name,minutes,price_sar,active) VALUES('${ids.service}','${ids.org}','Recovery synthetic service',30,50,true);
INSERT INTO public.glam_service_delivery_options(organization_id,service_id,channel) VALUES('${ids.org}','${ids.service}','salon');
INSERT INTO public.glam_service_specialists(service_id,specialist_id) VALUES('${ids.service}','${ids.specialist}');
INSERT INTO public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at) VALUES('${ids.org}','${ids.specialist}','shift',date_trunc('day',now())+interval '2 days 10 hours',date_trunc('day',now())+interval '2 days 18 hours');
INSERT INTO public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
SELECT v.id::uuid,'${ids.org}','${ids.specialist}','Recovery synthetic salon','Synthetic specialist',s.name,date_trunc('day',now())+interval '2 days 10 hours'+v.hour_offset*interval '1 hour',date_trunc('day',now())+interval '2 days 10 hours 30 minutes'+v.hour_offset*interval '1 hour',s.price_sar,s.id,s.revision FROM public.glam_services s CROSS JOIN (VALUES('${ids.a}',0),('${ids.b}',2),('${ids.c}',4))v(id,hour_offset) WHERE s.id='${ids.service}';
SELECT set_config('request.jwt.claim.sub','${ids.customer}',false);
SELECT public.glam_reserve('${ids.a}',gen_random_uuid());
SELECT public.glam_reserve('${ids.b}',gen_random_uuid());`,
);
function fingerprint(db) {
  return JSON.parse(
    sql(
      db,
      `SELECT json_build_object('services',(SELECT json_agg(to_jsonb(s) ORDER BY id) FROM public.glam_services s),'appointments',(SELECT json_agg(to_jsonb(a) ORDER BY id) FROM public.glam_appointments a),'reservations',(SELECT json_agg(to_jsonb(r)-'delivery_channel' ORDER BY id) FROM public.glam_reservations r));`,
    ),
  );
}
const before = fingerprint(source);
assert.equal(before.services.length, 1);
assert.equal(before.reservations.length, 2);
const baseDump = backup(source, "before");
for (let i = 0; i < 3; i++) apply(source, i);
assert.deepEqual(fingerprint(source), before);
let injected = false;
try {
  sql(source, "BEGIN; CREATE TABLE public.pr4_failure_probe(id integer); SELECT 1/0; COMMIT;");
} catch (e) {
  assert.match(e.message, /division by zero/);
  injected = true;
}
assert.ok(injected);
assert.equal(sql(source, "SELECT to_regclass('public.pr4_failure_probe') IS NULL;"), "t");
assert.equal(
  sql(source, "SELECT to_regprocedure('public.glam_reserve(uuid,uuid,text)') IS NULL;"),
  "t",
);
assert.deepEqual(fingerprint(source), before);
const recovered = restore(baseDump, "restored");
assert.deepEqual(fingerprint(recovered), before);
assert.equal(
  sql(
    recovered,
    "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='glam_reservations' AND column_name='delivery_channel';",
  ),
  "0",
);
for (let i = 0; i < 4; i++) apply(recovered, i);
assert.deepEqual(fingerprint(recovered), before);
assert.equal(
  sql(recovered, "SELECT count(*) FROM public.glam_reservations WHERE delivery_channel IS NULL;"),
  "2",
);
sql(
  recovered,
  `SELECT set_config('request.jwt.claim.sub','${ids.customer}',false); SELECT public.glam_reserve('${ids.c}',gen_random_uuid(),'salon');`,
);
const after = fingerprint(recovered);
assert.equal(after.reservations.length, 3);
const postDump = backup(recovered, "after");
const preserved = restore(postDump, "preserved");
assert.deepEqual(fingerprint(preserved), after);
assert.equal(
  sql(preserved, "SELECT count(*) FROM public.glam_reservations WHERE delivery_channel='salon';"),
  "1",
);
assert.equal(
  sql(preserved, "SELECT count(*) FROM public.glam_reservations WHERE delivery_channel IS NULL;"),
  "2",
);
const result = {
  passed: true,
  container,
  databases: { source, recovered, preserved },
  fixture: "synthetic only; no production rows",
  counts: {
    before: { services: 1, appointments: 3, reservations: 2 },
    after: { services: 1, appointments: 3, reservations: 3 },
  },
  preservedFullRowsAndIds: true,
  intentionalFailure: "division by zero between migrations 3 and 4; probe transaction rolled back",
  historicalNullPreserved: 2,
  postBackupBookingPreserved: 1,
  timing,
  limitation:
    "No production restore, cutover, ledger repair or concurrent post-backup reconciliation was attempted.",
};
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

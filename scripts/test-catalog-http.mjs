// Dedicated local Supabase Auth/PostgREST stack. Never reads application .env.
import { execFileSync, execFile } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { runContract } from "../supabase/tests/catalog-http-contract.mjs";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const docker =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin/docker.exe")
    : "docker";
const id = `glam-pr4-http-${Date.now()}`;
const dir = resolve("supabase/.temp", id);
mkdirSync(dir, { recursive: true });
const snapshot = resolve("supabase/.temp/glam-schema-only.sql");
if (
  createHash("sha256").update(readFileSync(snapshot)).digest("hex") !==
  "390756903381b1e8da2dcee4ab5b6cf9bcd32419e2d424c601b4a0d2b525d91e"
)
  throw Error("Unreviewed snapshot");
const secret = randomBytes(48).toString("hex");
const password = randomBytes(24).toString("hex");
function jwt(role, exp = Math.floor(Date.now() / 1000) + 3600) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ role, iss: "supabase", exp })).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}
const anon = jwt("anon"),
  admin = jwt("service_role");
function d(args, input) {
  try {
    return execFileSync(docker, args, {
      input,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    throw Error(
      `Docker ${args[0]} failed: ${String(e.stderr || "")
        .replaceAll(password, "[redacted]")
        .replaceAll(secret, "[redacted]")}`,
    );
  }
}
const db = `${id}-db`;
function sql(query, database = "postgres", role = "supabase_admin") {
  return d(
    ["exec", "-i", db, "psql", "-X", "-U", role, "-d", database, "-v", "ON_ERROR_STOP=1", "-At"],
    query,
  );
}
// Separate local PostgreSQL connection for deterministic lock/race assertions.
function sqlAsync(query) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      docker,
      [
        "exec",
        "-i",
        db,
        "psql",
        "-X",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      { encoding: "utf8", windowsHide: true },
      (error, stdout) => {
        if (error) reject(new Error("Concurrent local SQL failed"));
        else resolve(stdout);
      },
    );
    child.stdin.end(query);
  });
}
async function waitFor(test, label) {
  for (let n = 0; n < 60; n++) {
    try {
      if (await test()) return;
    } catch {
      /* readiness only */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error(`Timed out: ${label}; inspect local Docker logs (may contain test-only credentials)`);
}
function run(name, image, env, extra = []) {
  const file = join(dir, `${name}.env`);
  writeFileSync(
    file,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
  d([
    "run",
    "-d",
    "--name",
    `${id}-${name}`,
    "--network",
    id,
    "--network-alias",
    name,
    "--env-file",
    file,
    ...extra,
    image,
  ]);
}
const context = JSON.parse(d(["context", "inspect"]))[0];
if (
  !/^(npipe:|unix:)/.test(context.Endpoints.docker.Host) ||
  process.env.DOCKER_HOST ||
  process.env.DOCKER_CONTEXT
) {
  throw Error("Refusing Docker override or nonlocal daemon");
}
console.log(`Local stack: ${id}`);
try {
  d(["network", "create", "--internal", id]);
  run("db", "public.ecr.aws/supabase/postgres:17.6.1.166", { POSTGRES_PASSWORD: password });
  await waitFor(
    () => JSON.parse(d(["inspect", db]))[0].State.Health?.Status === "healthy",
    "PostgreSQL initialization",
  );
  d([
    "exec",
    db,
    "createdb",
    "-U",
    "supabase_admin",
    "-O",
    "postgres",
    "-T",
    "template0",
    "baseline",
  ]);
  d(["cp", snapshot, `${db}:/tmp/baseline.sql`]);
  d([
    "exec",
    db,
    "psql",
    "-X",
    "-U",
    "supabase_admin",
    "-d",
    "baseline",
    "-v",
    "ON_ERROR_STOP=1",
    "-1",
    "-f",
    "/tmp/baseline.sql",
  ]);
  // Auth is initialized by its own pinned server, not by faking migration ledger rows.
  sql(
    `alter role supabase_auth_admin password '${password}'; alter role authenticator password '${password}';`,
  );
  run("auth", "public.ecr.aws/supabase/gotrue:v2.197.0", {
    GOTRUE_API_HOST: "0.0.0.0",
    GOTRUE_API_PORT: 9999,
    API_EXTERNAL_URL: "http://localhost/auth/v1",
    GOTRUE_SITE_URL: "http://localhost",
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${password}@db:5432/postgres`,
    GOTRUE_JWT_SECRET: secret,
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_JWT_EXP: 3600,
    GOTRUE_EXTERNAL_EMAIL_ENABLED: true,
    GOTRUE_MAILER_AUTOCONFIRM: true,
    GOTRUE_DISABLE_SIGNUP: false,
    GOTRUE_RATE_LIMIT_EMAIL_SENT: 1000,
  });
  const port = (name) => JSON.parse(d(["inspect", `${id}-${name}`]))[0].NetworkSettings.Ports;
  await waitFor(
    () =>
      d(["exec", `${id}-auth`, "wget", "-qO-", "http://127.0.0.1:9999/health"]).includes("version"),
    "Auth",
  );
  const appSchema = d([
    "exec",
    db,
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "baseline",
    "--schema-only",
    "-n",
    "public",
    "-n",
    "glam_private",
  ]);
  sql("drop schema public cascade;");
  sql("alter database postgres owner to postgres;");
  sql(appSchema);
  // pg_dump assumes the bootstrap public schema's default PUBLIC USAGE grant.
  // Recreating that schema removes it, so reproduce the baseline explicitly.
  const publicUsage = sql(
    "select exists(select 1 from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='public' and a.grantee=0 and a.privilege_type='USAGE');",
    "baseline",
  ).trim();
  sql(
    publicUsage === "t"
      ? "grant usage on schema public to public;"
      : "revoke usage on schema public from public;",
  );
  const restoredSchema = d([
    "exec",
    db,
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--schema-only",
    "-n",
    "public",
    "-n",
    "glam_private",
  ]);
  const normalized = (dump) =>
    dump
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim() &&
          !line.startsWith("--") &&
          !line.startsWith("\\restrict") &&
          !line.startsWith("\\unrestrict") &&
          line !== "REVOKE USAGE ON SCHEMA public FROM PUBLIC;",
      )
      .sort()
      .join("\n");
  if (normalized(appSchema) !== normalized(restoredSchema)) {
    writeFileSync(join(dir, "application-before.sql"), appSchema);
    writeFileSync(join(dir, "application-after.sql"), restoredSchema);
    throw Error("Application schema differs after restore; inspect local schema-only comparison");
  }
  // pg_dump renders PUBLIC's initial schema ACL differently for a recreated
  // public schema. Compare the actual ACL/owner independently, not just its DDL.
  const schemaAcl = `select nspname,pg_get_userbyid(nspowner),a.grantor,a.grantee,a.privilege_type,a.is_grantable from pg_namespace n cross join lateral aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a where nspname in ('public','glam_private') order by 1,2,3,4,5,6;`;
  if (sql(schemaAcl, "baseline") !== sql(schemaAcl)) throw Error("Schema ACL/owner mismatch");
  const authHelpers = `select proname,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and proname in ('uid','jwt','role','email') order by proname;`;
  if (sql(authHelpers, "baseline") !== sql(authHelpers))
    throw Error("Auth JWT helper definitions differ from snapshot");
  console.log("Application schema definitions/ACLs match baseline before PR migrations");
  // Preserve and check every FK to auth.users; no application schema substitution.
  const links = (database) =>
    sql(
      "select count(*) from pg_constraint where contype='f' and confrelid='auth.users'::regclass and connamespace='public'::regnamespace;",
      database,
    ).trim();
  if (links("baseline") !== links("postgres")) throw Error("auth.users FK mismatch");
  console.log(`GLAM auth.users foreign keys preserved: ${links("postgres")}`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql(readFileSync(join("supabase/migrations", file), "utf8"), "postgres", "postgres");
  run("rest", "public.ecr.aws/supabase/postgrest:v16.3", {
    PGRST_DB_URI: `postgres://authenticator:${password}@db:5432/postgres`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: secret,
  });
  // Only the gateway has an ingress network; database/Auth/REST have no egress.
  const kong = join(dir, "kong.json");
  writeFileSync(
    kong,
    JSON.stringify({
      _format_version: "2.1",
      consumers: [{ username: "local-test", keyauth_credentials: [{ key: anon }] }],
      services: [
        ["auth", "http://auth:9999/", "/auth/v1/"],
        ["rest", "http://rest:3000/", "/rest/v1/"],
      ].map(([name, url, path]) => ({
        name,
        url,
        routes: [{ name, paths: [path], strip_path: true }],
        plugins: [
          {
            name: "cors",
            config: {
              origins: ["http://127.0.0.1:4175"],
              headers: [
                "Authorization",
                "apikey",
                "Content-Type",
                "Prefer",
                "X-Client-Info",
                "Accept-Profile",
                "Content-Profile",
                "X-Supabase-Api-Version",
              ],
              methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
              exposed_headers: ["Content-Range"],
              credentials: true,
            },
          },
          {
            name: "key-auth",
            config: { key_names: ["apikey"], hide_credentials: true, run_on_preflight: false },
          },
        ],
      })),
    }),
  );
  d(["network", "create", `${id}-ingress`]);
  d([
    "run",
    "-d",
    "--name",
    `${id}-gateway`,
    "--network",
    `${id}-ingress`,
    "-p",
    "127.0.0.1::8000",
    "-v",
    `${kong}:/kong.json:ro`,
    "-e",
    "KONG_DATABASE=off",
    "-e",
    "KONG_DECLARATIVE_CONFIG=/kong.json",
    "-e",
    "KONG_PROXY_LISTEN=0.0.0.0:8000",
    "-e",
    "KONG_ADMIN_LISTEN=off",
    "public.ecr.aws/supabase/kong:2.8.1",
  ]);
  d(["network", "connect", id, `${id}-gateway`]);
  const baseURL = `http://127.0.0.1:${port("gateway")["8000/tcp"][0].HostPort}`;
  const authURL = `${baseURL}/auth/v1`,
    restURL = `${baseURL}/rest/v1`;
  await waitFor(
    async () => (await fetch(`${restURL}/`, { headers: { apikey: anon } })).ok,
    "gateway/PostgREST",
  );
  for (const name of ["db", "auth", "rest"]) {
    const info = JSON.parse(d(["inspect", `${id}-${name}`]))[0];
    if (
      Object.keys(info.NetworkSettings.Networks).join() !== id ||
      Object.keys(info.HostConfig.PortBindings ?? {}).length
    )
      throw Error("Backend isolation mismatch");
  }
  if (!JSON.parse(d(["network", "inspect", id]))[0].Internal)
    throw Error("Backend network is not internal");
  if (port("gateway")["8000/tcp"].some((binding) => binding.HostIp !== "127.0.0.1"))
    throw Error("Gateway must be loopback-only");
  const execute = process.argv.includes("--browser")
    ? (await import("../tests/e2e/catalog-browser.mjs")).runBrowserContract
    : runContract;
  const result = await execute({
    sqlAsync,
    baseURL,
    dir,
    authURL,
    restURL,
    anon,
    admin,
    expired: jwt("authenticated", 1),
    sql,
  });
  writeFileSync(
    join(dir, "result.json"),
    JSON.stringify({ stack: id, authUserLinks: links("postgres"), ...result }, null, 2),
  );
  const gaps = result.blockers?.length ?? 0;
  for (const gap of result.blockers ?? []) console.log(`UI_GAP: ${gap}`);
  console.log(
    `${gaps ? "INCOMPLETE" : "PASS"}: ${result.passed} ${process.argv.includes("--browser") ? "browser checkpoints" : "HTTP assertions"}; ${gaps} coverage gaps. Report: ${join(dir, "result.json")}`,
  );
  // Do not turn a missing requested UI feature into a green integration gate.
  if (gaps) process.exitCode = 2;
} finally {
  // Stop only containers created by this run; retain data for local inspection.
  for (const name of ["gateway", "rest", "auth", "db"]) {
    try {
      d(["stop", `${id}-${name}`]);
    } catch {
      /* container may not have started */
    }
  }
  // Keep stopped containers/volumes for inspection, but release this run's
  // ephemeral subnets. Retaining two networks per run exhausts Docker's pools.
  for (const network of [id, `${id}-ingress`]) {
    let info;
    try {
      info = JSON.parse(d(["network", "inspect", network]))[0];
    } catch {
      continue;
    } // Setup may have failed before creating this network.
    const members = Object.entries(info.Containers ?? {});
    const expected = new Set(["gateway", "rest", "auth", "db"].map((name) => `${id}-${name}`));
    if (members.some(([, member]) => !expected.has(member.Name))) {
      console.log(`CLEANUP_SKIPPED: unexpected member on ${network}`);
      continue;
    }
    if (members.some(([containerId]) => JSON.parse(d(["inspect", containerId]))[0].State.Running)) {
      console.log(`CLEANUP_SKIPPED: container still running on ${network}`);
      continue;
    }
    for (const [containerId] of members) d(["network", "disconnect", network, containerId]);
    d(["network", "rm", network]);
  }
}

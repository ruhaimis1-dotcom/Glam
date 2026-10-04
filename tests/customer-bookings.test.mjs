import test from "node:test";
import assert from "node:assert/strict";
import { startCustomerBookingsLoad } from "../src/repositories/customer-bookings.ts";
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  let user = { id: "customer-a" },
    listener,
    unsubscribed = false;
  const pending = [],
    states = [],
    customers = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: (callback) => {
        listener = callback;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribed = true;
              },
            },
          },
        };
      },
    },
    from: (table) => {
      assert.equal(table, "glam_reservations");
      return {
        select: () => ({
          eq: (column, id) => {
            assert.equal(column, "customer_id");
            customers.push(id);
            return {
              order: () => new Promise((resolve) => pending.push(resolve)),
            };
          },
        }),
      };
    },
  };
  const stop = startCustomerBookingsLoad(client, (state) => states.push(state));
  return {
    pending,
    states,
    customers,
    stop,
    switchUser(next) {
      user = next;
      listener();
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
}
test("server empty response stays empty; no cached fallback", async () => {
  const f = fixture();
  await tick();
  f.pending.shift()({ data: [], error: null });
  await tick();
  assert.deepEqual(f.states.at(-1), { status: "ready", bookings: [] });
  assert.deepEqual(f.customers, ["customer-a"]);
  f.stop();
});
test("read failures show error rather than an empty success", async () => {
  const f = fixture();
  await tick();
  f.pending.shift()({ data: null, error: { message: "private detail" } });
  await tick();
  assert.deepEqual(f.states.at(-1), { status: "error" });
  f.stop();
});
test("account switch immediately clears visible bookings and discards stale response", async () => {
  const f = fixture();
  await tick();
  const old = f.pending.shift();
  f.switchUser({ id: "customer-b" });
  assert.deepEqual(f.states.at(-1), { status: "loading" });
  await tick();
  f.pending.shift()({ data: [], error: null });
  await tick();
  const count = f.states.length;
  old({ data: [{ id: "old-booking", status: "confirmed", glam_appointments: null }], error: null });
  await tick();
  assert.equal(f.states.length, count);
  assert.deepEqual(f.customers, ["customer-a", "customer-b"]);
  f.stop();
});
test("sign-out clears immediately and does not query reservations anonymously", async () => {
  const f = fixture();
  await tick();
  f.switchUser(null);
  assert.equal(f.states.at(-1).status, "loading");
  await tick();
  assert.equal(f.states.at(-1).status, "anonymous");
  assert.equal(f.customers.length, 1);
  f.stop();
});
test("unmount unsubscribes and rejects late responses", async () => {
  const f = fixture();
  await tick();
  f.stop();
  const count = f.states.length;
  f.pending.shift()({ data: [], error: null });
  await tick();
  assert.equal(f.states.length, count);
  assert.equal(f.unsubscribed, true);
});
test("reservation time is displayed in Riyadh and status in Arabic", async () => {
  const f = fixture();
  await tick();
  f.pending.shift()({
    data: [
      {
        id: "one",
        status: "confirmed",
        glam_appointments: {
          salon_name: "صالون",
          service_name: "خدمة",
          starts_at: "2026-10-04T12:30:00Z",
        },
      },
    ],
    error: null,
  });
  await tick();
  const booking = f.states.at(-1).bookings[0];
  assert.equal(booking.status, "مؤكد");
  assert.equal(booking.time, "٣:٣٠ م");
  f.stop();
});

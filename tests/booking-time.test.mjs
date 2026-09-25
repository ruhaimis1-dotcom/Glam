import assert from "node:assert/strict";
import { bookingDateKey, bookingTime, bookingErrorCode } from "../src/lib/booking-time.ts";
const expected = bookingTime("2026-09-22T07:00:00Z");
for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
  process.env.TZ = zone;
  assert.equal(bookingDateKey("2026-09-21T22:30:00Z"), "2026-09-22");
  assert.equal(bookingDateKey("2026-09-21T20:59:00Z"), "2026-09-21");
  assert.equal(bookingTime("2026-09-22T07:00:00Z"), expected);
}
assert.equal(
  bookingErrorCode({ code: "23505", message: "duplicate key" }),
  "APPOINTMENT_UNAVAILABLE",
);
assert.equal(bookingErrorCode(new Error("AUTH_REQUIRED")), "AUTH_REQUIRED");
console.log("11 assertions passed");

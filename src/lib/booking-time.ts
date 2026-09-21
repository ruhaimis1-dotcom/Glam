export const BOOKING_TIME_ZONE = "Asia/Riyadh";
export function bookingDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function bookingTime(value: string) {
  return new Date(value).toLocaleTimeString("ar-SA", { timeZone: BOOKING_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}
export function bookingDate(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00+03:00` : value).toLocaleDateString("ar-SA", { timeZone: BOOKING_TIME_ZONE, calendar: "gregory", dateStyle: "medium" });
}
export function bookingErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string };
    return e.code === "23505" ? "APPOINTMENT_UNAVAILABLE" : e.message ?? "BOOKING_FAILED";
  }
  return "BOOKING_FAILED";
}

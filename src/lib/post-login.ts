import { parseAdminOverview, type AdminReadError } from "./admin-access-state.ts";

type Reads = {
  identity: () => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
  admin: () => PromiseLike<{ data: unknown; error: AdminReadError | null }>;
  businesses: () => PromiseLike<readonly { id: string }[]>;
};

/** Routing is not authorization: each destination still enforces its own access guard. */
export async function resolvePostLogin(
  reads: Reads,
  expectedUserId: string,
  current: () => boolean = () => true,
): Promise<"/admin" | "/business" | "/bookings"> {
  async function confirmIdentity() {
    const result = await reads.identity();
    if (!current() || result.error || !expectedUserId || result.data.user?.id !== expectedUserId)
      throw new Error("LOGIN_IDENTITY_CHANGED");
  }
  await confirmIdentity();
  const admin = await reads.admin();
  if (!current()) throw new Error("LOGIN_IDENTITY_CHANGED");
  let destination: "/admin" | "/business" | "/bookings";
  if (!admin.error && parseAdminOverview(admin.data)) destination = "/admin";
  else if (admin.error?.code === "42501" && admin.error.message === "FORBIDDEN") {
    const businesses = await reads.businesses();
    if (!Array.isArray(businesses)) throw new Error("LOGIN_ACCESS_UNCONFIRMED");
    destination = businesses.length ? "/business" : "/bookings";
  } else throw new Error("LOGIN_ACCESS_UNCONFIRMED");
  await confirmIdentity();
  return destination;
}

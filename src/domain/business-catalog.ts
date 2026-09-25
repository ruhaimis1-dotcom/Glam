// Mirrors the GLAM database inspected on 2026-09-25, not the proposed P1 model.
export type CatalogService = {
  id: string;
  organization_id: string;
  name: string;
  minutes: number;
  price_sar: number;
  active: boolean;
  revision: number;
  category_id: string | null;
  subcategory_id: string | null;
  pricing_mode: "fixed" | "from" | "range" | "variants";
  buffer_minutes: number;
};
export type CatalogCategory = {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  category_id?: string;
};
export type ServiceInput = Omit<CatalogService, "id" | "organization_id" | "revision">;

export function validateService(input: ServiceInput) {
  if (!input.name.trim() || input.name.trim().length > 120) throw new Error("INVALID_NAME");
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 15 ||
    input.minutes > 480 ||
    input.minutes % 15
  )
    throw new Error("INVALID_DURATION");
  if (!Number.isFinite(input.price_sar) || input.price_sar < 0 || input.price_sar > 10000)
    throw new Error("INVALID_PRICE");
  if (
    !Number.isInteger(input.buffer_minutes) ||
    input.buffer_minutes < 0 ||
    input.buffer_minutes > 120
  )
    throw new Error("INVALID_BUFFER");
  if (!["fixed", "from", "range", "variants"].includes(input.pricing_mode))
    throw new Error("INVALID_PRICING_MODE");
  if (input.subcategory_id && !input.category_id) throw new Error("INVALID_CATEGORY");
  if (typeof input.active !== "boolean") throw new Error("INVALID_STATUS");
}

export function catalogError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "42501" || code === "PGRST202")
    return "الكتالوج غير متاح بعد. يلزم استكمال إعداد صلاحيات قاعدة البيانات بواسطة المسؤول.";
  if (code === "23505") return "يوجد اسم مماثل في هذا التصنيف أو المؤسسة.";
  if (code === "23503")
    return "لا يمكن الحذف لوجود بيانات مرتبطة. يمكنك إيقاف الخدمة بدلاً من حذفها.";
  if (message === "FORBIDDEN" || message === "AUTH_REQUIRED")
    return "انتهت الجلسة أو لم تعد لديك صلاحية إدارة هذه المؤسسة.";
  if (message.startsWith("INVALID_"))
    return "راجعي الاسم والسعر والمدة والتصنيف. المدة من 15 إلى 480 دقيقة بمضاعفات 15.";
  return "تعذر إتمام العملية. تحققي من الاتصال والصلاحيات ثم أعيدي المحاولة.";
}

import { supabase } from "@/lib/supabase";
import type { IntelligentService, ServiceCategory, ServiceVariant } from "@/domain/service-intelligence";

type ServiceRow = {
  id: string;
  organization_id: string | null;
  category_id: string | null;
  name_ar: string | null;
  name_en: string | null;
  name?: string | null;
  description_ar: string | null;
  description_en: string | null;
  status: IntelligentService["status"];
  pricing_mode: IntelligentService["pricingMode"];
  base_price_sar: number | null;
  duration_minutes: number | null;
  prep_buffer_minutes: number;
  cleanup_buffer_minutes: number;
  intelligence_notes: string | null;
  female_professional_required: boolean;
  private_room_supported: boolean;
  private_room_required: boolean;
  photography_policy: IntelligentService["photographyPolicy"];
};

export async function listServiceCategories(organizationId: string): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from("glam_service_categories")
    .select("id,organization_id,parent_id,name_ar,name_en,active,sort_order")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    parentId: row.parent_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

export async function listIntelligentServices(organizationId: string): Promise<IntelligentService[]> {
  const { data, error } = await supabase
    .from("glam_services")
    .select("id,organization_id,category_id,name_ar,name_en,name,description_ar,description_en,status,pricing_mode,base_price_sar,duration_minutes,prep_buffer_minutes,cleanup_buffer_minutes,intelligence_notes,female_professional_required,private_room_supported,private_room_required,photography_policy")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("name_ar");
  if (error) throw error;

  const rows = (data ?? []) as ServiceRow[];
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [{ data: variants, error: variantError }, { data: rules, error: ruleError }] = await Promise.all([
    supabase.from("glam_service_variants").select("id,service_id,name_ar,name_en,price_sar,duration_minutes,active,sort_order").in("service_id", ids).order("sort_order"),
    supabase.from("glam_service_profile_rules").select("id,service_id,dimension,attribute_key,operator,attribute_value,severity,note_ar,note_en").in("service_id", ids),
  ]);
  if (variantError) throw variantError;
  if (ruleError) throw ruleError;

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    categoryId: row.category_id,
    nameAr: row.name_ar ?? row.name ?? "",
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    status: row.status,
    pricingMode: row.pricing_mode,
    basePriceSar: row.base_price_sar == null ? null : Number(row.base_price_sar),
    durationMinutes: row.duration_minutes,
    prepBufferMinutes: row.prep_buffer_minutes,
    cleanupBufferMinutes: row.cleanup_buffer_minutes,
    intelligenceNotes: row.intelligence_notes,
    femaleProfessionalRequired: row.female_professional_required,
    privateRoomSupported: row.private_room_supported,
    privateRoomRequired: row.private_room_required,
    photographyPolicy: row.photography_policy,
    variants: ((variants ?? []) as any[]).filter((item) => item.service_id === row.id).map((item): ServiceVariant => ({
      id: item.id, serviceId: item.service_id, nameAr: item.name_ar, nameEn: item.name_en,
      priceSar: item.price_sar == null ? null : Number(item.price_sar), durationMinutes: item.duration_minutes,
      active: item.active, sortOrder: item.sort_order,
    })),
    profileRules: ((rules ?? []) as any[]).filter((item) => item.service_id === row.id).map((item) => ({
      id: item.id, serviceId: item.service_id, dimension: item.dimension, attributeKey: item.attribute_key,
      operator: item.operator, attributeValue: item.attribute_value, severity: item.severity,
      noteAr: item.note_ar, noteEn: item.note_en,
    })),
  }));
}

export type CreateIntelligentServiceInput = Omit<IntelligentService, "id" | "variants" | "profileRules">;

export async function createIntelligentService(input: CreateIntelligentServiceInput): Promise<string> {
  if (!input.organizationId) throw new Error("ORGANIZATION_REQUIRED");
  const { data, error } = await supabase.from("glam_services").insert({
    organization_id: input.organizationId,
    category_id: input.categoryId,
    name_ar: input.nameAr.trim(),
    name: input.nameAr.trim(),
    name_en: input.nameEn,
    description_ar: input.descriptionAr,
    description_en: input.descriptionEn,
    status: input.status,
    pricing_mode: input.pricingMode,
    base_price_sar: input.basePriceSar,
    duration_minutes: input.durationMinutes,
    prep_buffer_minutes: input.prepBufferMinutes,
    cleanup_buffer_minutes: input.cleanupBufferMinutes,
    intelligence_notes: input.intelligenceNotes,
    female_professional_required: input.femaleProfessionalRequired,
    private_room_supported: input.privateRoomSupported,
    private_room_required: input.privateRoomRequired,
    photography_policy: input.photographyPolicy,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

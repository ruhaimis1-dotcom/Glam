export type ServiceStatus = "draft" | "active" | "archived";
export type PricingMode = "fixed" | "starts_from" | "variants";
export type BeautyDimension = "hair" | "skin" | "nails";
export type ProfileRuleOperator = "supports" | "prefers" | "excludes" | "warns";
export type RuleSeverity = "info" | "warning" | "block";
export type PhotographyPolicy = "salon_policy" | "allowed_with_consent" | "prohibited";

export interface ServiceCategory {
  id: string;
  organizationId: string;
  parentId: string | null;
  nameAr: string;
  nameEn: string | null;
  active: boolean;
  sortOrder: number;
}

export interface ServiceVariant {
  id: string;
  serviceId: string;
  nameAr: string;
  nameEn: string | null;
  priceSar: number | null;
  durationMinutes: number | null;
  active: boolean;
  sortOrder: number;
}

export interface ServiceProfileRule {
  id: string;
  serviceId: string;
  dimension: BeautyDimension;
  attributeKey: string;
  operator: ProfileRuleOperator;
  attributeValue: string;
  severity: RuleSeverity;
  noteAr: string | null;
  noteEn: string | null;
}

export interface IntelligentService {
  id: string;
  organizationId: string | null;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  status: ServiceStatus;
  pricingMode: PricingMode;
  basePriceSar: number | null;
  durationMinutes: number | null;
  prepBufferMinutes: number;
  cleanupBufferMinutes: number;
  intelligenceNotes: string | null;
  femaleProfessionalRequired: boolean;
  privateRoomSupported: boolean;
  privateRoomRequired: boolean;
  photographyPolicy: PhotographyPolicy;
  variants: ServiceVariant[];
  profileRules: ServiceProfileRule[];
}

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: "مسودة",
  active: "نشطة",
  archived: "مؤرشفة",
};

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  fixed: "سعر ثابت",
  starts_from: "يبدأ من",
  variants: "حسب الخيار",
};

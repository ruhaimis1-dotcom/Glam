import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock3, Plus, Search, Sparkles, WandSparkles } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { PRICING_MODE_LABELS, SERVICE_STATUS_LABELS, type IntelligentService } from "@/domain/service-intelligence";

export const Route = createFileRoute("/business/services")({ component: ServicesPage });

const previewServices: IntelligentService[] = [
  {
    id: "preview-1", organizationId: null, categoryId: "hair", nameAr: "بالياج كامل", nameEn: "Full Balayage",
    descriptionAr: "تفتيح وتدرج لوني مخصص حسب قاعدة الشعر والنتيجة المطلوبة.", descriptionEn: null,
    status: "active", pricingMode: "starts_from", basePriceSar: 650, durationMinutes: 180,
    prepBufferMinutes: 15, cleanupBufferMinutes: 15, intelligenceNotes: "يحتاج تقييم قاعدة الشعر قبل التأكيد.",
    femaleProfessionalRequired: true, privateRoomSupported: true, privateRoomRequired: false,
    photographyPolicy: "allowed_with_consent", variants: [], profileRules: [],
  },
  {
    id: "preview-2", organizationId: null, categoryId: "hair", nameAr: "قص وتصفيف", nameEn: "Cut & Style",
    descriptionAr: "قص وتصفيف مع تحديد النتيجة المناسبة لنوع الشعر.", descriptionEn: null,
    status: "active", pricingMode: "fixed", basePriceSar: 180, durationMinutes: 60,
    prepBufferMinutes: 5, cleanupBufferMinutes: 10, intelligenceNotes: null,
    femaleProfessionalRequired: true, privateRoomSupported: false, privateRoomRequired: false,
    photographyPolicy: "salon_policy", variants: [], profileRules: [],
  },
  {
    id: "preview-3", organizationId: null, categoryId: "makeup", nameAr: "مكياج سهرة", nameEn: "Evening Makeup",
    descriptionAr: "مكياج مناسبة مع تخصيص اللوك حسب البشرة والتفضيلات.", descriptionEn: null,
    status: "draft", pricingMode: "fixed", basePriceSar: 350, durationMinutes: 75,
    prepBufferMinutes: 10, cleanupBufferMinutes: 10, intelligenceNotes: "ربط الحساسية والمنتجات في الخطوة التالية.",
    femaleProfessionalRequired: true, privateRoomSupported: true, privateRoomRequired: false,
    photographyPolicy: "prohibited", variants: [], profileRules: [],
  },
];

function ServicesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "draft">("all");
  const services = useMemo(() => previewServices.filter((service) => {
    const matchesQuery = !query || service.nameAr.includes(query) || service.nameEn?.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || service.status === status);
  }), [query, status]);

  return (
    <BusinessShell>
      <PageHeader
        title="الخدمات الذكية"
        desc="ابني كتالوج خدمات يفهم المدة والسعر والخصوصية ويستعد للربط مع جواز جمال العميلة."
        action={
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
            <Plus className="size-4" /> إضافة خدمة
          </button>
        }
      />

      <section className="mb-6 rounded-[28px] border bg-gradient-to-l from-primary/10 via-card to-card p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></div>
          <div>
            <p className="text-xs font-semibold text-primary">GLAM SERVICE INTELLIGENCE</p>
            <h2 className="mt-1 text-lg font-bold">كل خدمة تصبح جزءًا من ذكاء GLAM</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">نرتب التصنيف والترجمة والمدة ووقت التجهيز وقواعد الملاءمة، ثم نستخدمها لاحقًا لمطابقة الخدمة مع جواز جمال العميلة.</p>
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحثي عن خدمة..." className="w-full rounded-2xl border bg-card py-3 pe-4 ps-11 text-sm outline-none focus:border-primary" />
        </label>
        <div className="flex rounded-2xl border bg-card p-1">
          {([["all","الكل"],["active","نشطة"],["draft","مسودة"]] as const).map(([value,label]) => (
            <button key={value} onClick={() => setStatus(value)} className={`rounded-xl px-4 py-2 text-sm transition ${status === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <article key={service.id} className="glam-card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold">{service.nameAr}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${service.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{SERVICE_STATUS_LABELS[service.status]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{service.nameEn}</p>
              </div>
              <button className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary">تعديل</button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{service.descriptionAr}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-sm">
              <div><p className="text-xs text-muted-foreground">{PRICING_MODE_LABELS[service.pricingMode]}</p><p className="mt-1 font-bold">{service.basePriceSar ? `${service.basePriceSar} ر.س` : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">مدة الخدمة</p><p className="mt-1 flex items-center gap-1 font-bold"><Clock3 className="size-3.5" /> {service.durationMinutes ?? "—"} د</p></div>
              <div><p className="text-xs text-muted-foreground">وقت إضافي</p><p className="mt-1 font-bold">{service.prepBufferMinutes + service.cleanupBufferMinutes} د</p></div>
            </div>
            {service.intelligenceNotes && <div className="mt-4 flex gap-2 rounded-2xl bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><WandSparkles className="mt-0.5 size-4 shrink-0 text-primary" /><span>{service.intelligenceNotes}</span></div>}
          </article>
        ))}
      </div>
    </BusinessShell>
  );
}

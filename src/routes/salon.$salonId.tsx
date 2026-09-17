import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { byId, formatSAR } from "@/data/mock";
import { CustomerShell } from "@/components/glam/shells";
import { PrivacyBadges, SalonCover, Stars } from "@/components/glam/ui";

export const Route = createFileRoute("/salon/$salonId")({ component: SalonPage });

function SalonPage() {
  const { salonId } = Route.useParams();
  const salon = byId.salon(salonId);

  if (!salon) {
    return (
      <CustomerShell title="الصالون" back="/">
        <div className="glam-card py-16 text-center">
          <h1 className="text-xl font-bold">الصالون غير موجود</h1>
          <p className="mt-2 text-sm text-muted-foreground">قد يكون الرابط غير صحيح أو أن الصالون غير متاح حالياً.</p>
          <Link to="/" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">العودة للرئيسية</Link>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title={salon.name} back="/">
      <div className="overflow-hidden rounded-3xl border bg-card">
        <SalonCover salon={salon} className="h-56 sm:h-72" />
        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{salon.name}</h1>
                {salon.verified && <ShieldCheck className="size-5 text-primary" aria-label="معتمد" />}
              </div>
              <p className="mt-1 text-muted-foreground">{salon.tagline}</p>
            </div>
            <Stars value={salon.rating} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-primary" />{salon.area} · {salon.district}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-4 text-primary" />{salon.availableToday ? `متاح ${salon.nextSlot}` : `أقرب موعد ${salon.nextSlot}`}</span>
          </div>
          <PrivacyBadges privacy={salon.privacy} />
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">تبدأ الخدمات من</p>
            <p className="mt-1 text-xl font-bold">{formatSAR(salon.priceFrom)}</p>
          </div>
          <button type="button" className="w-full rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground hover:bg-primary/90">
            اختاري الخدمة والموعد
          </button>
          <p className="text-center text-xs text-muted-foreground">سيتم تفعيل الحجز الفعلي بعد ربط قاعدة البيانات والدفع.</p>
        </div>
      </div>
    </CustomerShell>
  );
}

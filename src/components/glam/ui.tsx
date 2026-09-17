import { Link } from "@tanstack/react-router";
import { Star, ShieldCheck, Lock, CameraOff, EyeOff, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { byId, formatSAR, type Salon } from "@/data/mock";
import type { PrivacyPrefs } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export function GlamLogo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-display font-extrabold tracking-[0.18em]", className)}>
      <span className={light ? "text-primary-foreground" : "text-primary"}>GLAM</span>
      <span className="text-rose-gold text-[0.55em] tracking-widest font-semibold">SAUDI</span>
    </span>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-foreground", className)} aria-label={`التقييم ${value} من 5`}>
      <Star style={{ width: size, height: size }} className="fill-rose-gold text-rose-gold" />
      <span className="text-sm font-semibold tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

export const PRIVACY_ITEMS: { key: keyof PrivacyPrefs; label: string; short: string; icon: LucideIcon; desc: string }[] = [
  { key: "femaleOnly", label: "موظفات فقط", short: "موظفات", icon: UserRound, desc: "طاقم نسائي بالكامل طوال الزيارة" },
  { key: "privateRoom", label: "غرفة خاصة", short: "غرفة خاصة", icon: Lock, desc: "جلستك في غرفة مغلقة بعيدًا عن الصالة" },
  { key: "noPhoto", label: "بدون تصوير", short: "بدون تصوير", icon: CameraOff, desc: "لا يُسمح بأي تصوير أثناء الخدمة" },
  { key: "noMarketingUse", label: "عدم استخدام الصور تسويقيًا", short: "بدون نشر", icon: EyeOff, desc: "أي صورة للنتيجة تبقى لك فقط" },
];

export function PrivacyBadges({ privacy, compact }: { privacy: PrivacyPrefs; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRIVACY_ITEMS.filter((p) => privacy[p.key]).map((p) => (
        <Badge key={p.key} variant="secondary" className="gap-1 rounded-full bg-rose-soft text-accent-foreground font-medium">
          <p.icon className="size-3" />
          {compact ? p.short : p.label}
        </Badge>
      ))}
    </div>
  );
}

export function SalonCover({ salon, className }: { salon: Salon; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", salon.tone, className)} aria-hidden>
      <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
      <div className="absolute bottom-3 end-3 font-display text-3xl font-extrabold tracking-widest text-primary-foreground/25">
        GLAM
      </div>
    </div>
  );
}

export function SalonCard({ salon, className }: { salon: Salon; className?: string }) {
  return (
    <Link
      to="/salon/$salonId"
      params={{ salonId: salon.id }}
      className={cn(
        "group glam-card flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <SalonCover salon={salon} className="h-32" />
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-foreground">{salon.name}</h3>
            <p className="truncate text-sm text-muted-foreground">{salon.tagline}</p>
          </div>
          <Stars value={salon.rating} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{salon.area} · {salon.district}</span>
          <span className="text-foreground font-medium">تبدأ من {formatSAR(salon.priceFrom)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              salon.availableToday ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full", salon.availableToday ? "bg-success" : "bg-muted-foreground")} />
            {salon.availableToday ? `متاح ${salon.nextSlot}` : `أقرب موعد ${salon.nextSlot}`}
          </span>
          {salon.verified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" /> معتمد
            </span>
          )}
        </div>
        <PrivacyBadges privacy={salon.privacy} compact />
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {salon.categories.map((c) => (
            <span key={c} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              {byId.category(c).label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function SectionTitle({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }: { icon: LucideIcon; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="glam-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-rose-soft text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "plum" | "gold" | "success" | "warning" }) {
  return (
    <div
      className={cn(
        "glam-card p-4",
        tone === "plum" && "glam-gradient border-transparent text-primary-foreground",
        tone === "gold" && "bg-rose-gold/15 border-rose-gold/30",
      )}
    >
      <p className={cn("text-xs font-medium", tone === "plum" ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs",
            tone === "plum" ? "text-primary-foreground/70" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-full glam-gradient font-display text-lg font-bold text-primary-foreground", className)}>
      {initials}
    </span>
  );
}

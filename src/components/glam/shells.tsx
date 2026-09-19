import { Link, type LinkProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Home, CalendarDays, UserRound, Store, LayoutDashboard, Clock, Scissors, Users, ShieldCheck,
  Building2, BookOpenCheck, Gavel, ArrowLeftRight, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { GlamLogo } from "./ui";

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon; exact?: boolean };

/* ---------------- Customer app ---------------- */

const CUSTOMER_NAV: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: Home, exact: true },
  { to: "/bookings", label: "حجوزاتي", icon: CalendarDays },
  { to: "/profile", label: "ملفي", icon: UserRound },
];

export function CustomerShell({ children, title, back }: { children: ReactNode; title?: string; back?: NonNullable<LinkProps["to"]> }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            {back ? (
              <Link to={back} className="grid size-9 place-items-center rounded-full border bg-card hover:bg-accent" aria-label="رجوع">
                <ArrowLeftRight className="size-4 rotate-180" />
              </Link>
            ) : null}
            <Link to="/" aria-label="Glam الرئيسية">
              <GlamLogo className="text-2xl" />
            </Link>
            {title && <span className="hidden text-sm text-muted-foreground sm:inline">/ {title}</span>}
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
            {CUSTOMER_NAV.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                activeOptions={{ exact: n.exact ?? false }}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
              >
                {n.label}
              </Link>
            ))}
            <span className="mx-2 h-5 w-px bg-border" />
            <Link to="/business" className="rounded-full px-3 py-2 text-sm font-medium text-primary hover:bg-accent">
              Glam Business
            </Link>
            <Link to="/admin" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent">
              الإدارة
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-safe pt-5 md:pb-16">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md md:hidden"
        aria-label="التنقل السفلي"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {CUSTOMER_NAV.map((n) => (
            <li key={n.label}>
              <Link
                to={n.to}
                activeOptions={{ exact: n.exact ?? false }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary"
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/business" className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary">
              <Store className="size-5" />
              الأعمال
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/* ---------------- Sidebar shells (Business / Admin) ---------------- */

const BUSINESS_NAV: NavItem[] = [
  { to: "/business", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { to: "/business/schedule", label: "جدول اليوم", icon: Clock },
  { to: "/business/services", label: "الخدمات", icon: Scissors },
  { to: "/business/staff", label: "الموظفات", icon: Users },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "المؤشرات", icon: LayoutDashboard, exact: true },
  { to: "/admin/salons", label: "الصالونات والاعتماد", icon: Building2 },
  { to: "/admin/bookings", label: "الحجوزات", icon: BookOpenCheck },
  { to: "/admin/disputes", label: "النزاعات", icon: Gavel },
];

function SidebarShell({
  children, nav, brand, subtitle, switchTo, switchLabel,
}: { children: ReactNode; nav: NavItem[]; brand: ReactNode; subtitle: string; switchTo: NonNullable<LinkProps["to"]>; switchLabel: string }) {
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-e bg-sidebar md:flex md:flex-col">
        <div className="border-b px-6 py-5">
          {brand}
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="قائمة اللوحة">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              activeOptions={{ exact: n.exact ?? false }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link to={switchTo} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-primary hover:bg-sidebar-accent">
            <ArrowLeftRight className="size-3.5" /> {switchLabel}
          </Link>
          <Link to="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
            <Home className="size-3.5" /> تطبيق العميلة
          </Link>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:hidden">
          {brand}
          <Link to="/" className="text-xs text-muted-foreground">تطبيق العميلة</Link>
        </header>
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              activeOptions={{ exact: n.exact ?? false }}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

export function BusinessShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email !== "ruhaimi.s1@gmail.com") navigate({ to: "/bookings", replace: true });
    });
  }, [navigate]);
  return (
    <SidebarShell
      nav={BUSINESS_NAV}
      brand={<span className="flex items-center gap-2"><GlamLogo className="text-xl" /><span className="rounded-full bg-rose-gold/20 px-2 py-0.5 text-[10px] font-bold text-rose-gold-foreground">BUSINESS</span></span>}
      subtitle="لوميير ستوديو · حي الملقا"
      switchTo="/admin"
      switchLabel="لوحة إدارة Glam"
    >
      {children}
    </SidebarShell>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email !== "saud@hirely.sa") navigate({ to: "/bookings", replace: true });
    });
  }, [navigate]);
  return (
    <SidebarShell
      nav={ADMIN_NAV}
      brand={<span className="flex items-center gap-2"><GlamLogo className="text-xl" /><span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"><ShieldCheck className="size-3" />ADMIN</span></span>}
      subtitle="عمليات المنصة · الرياض"
      switchTo="/business"
      switchLabel="Glam Business"
    >
      {children}
    </SidebarShell>
  );
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className={cn("mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3")}>
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

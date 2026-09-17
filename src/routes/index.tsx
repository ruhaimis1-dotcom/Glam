import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { CATEGORIES, INTENTS, SALONS } from "@/data/mock";
import { GlamLogo, SalonCard, SectionTitle } from "@/components/glam/ui";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <GlamLogo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#discover" className="transition-colors hover:text-foreground">اكتشفي</a>
            <a href="#how" className="transition-colors hover:text-foreground">كيف تعمل Glam؟</a>
            <Link to="/bookings" className="transition-colors hover:text-foreground">حجوزاتي</Link>
          </nav>
          <Link to="/bookings" className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            تسجيل الدخول
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-plum-deep px-4 py-16 text-primary-foreground sm:py-24">
          <div className="absolute -left-24 -top-24 size-72 rounded-full bg-rose/20 blur-3xl" />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-sm">
                <Sparkles className="size-4 text-rose-gold" />
                جمالك، بطريقتك
              </div>
              <h1 className="text-4xl font-bold leading-tight sm:text-6xl">اكتشفي المكان المناسب لكِ، واحجزي بثقة.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-primary-foreground/75">صالونات وخبيرات موثوقة، أسعار واضحة، ومواعيد تناسبك—مع خصوصيتك في كل خطوة.</p>
              <div className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-background p-2 text-foreground shadow-xl">
                <Search className="mx-2 size-5 text-muted-foreground" />
                <input className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none" placeholder="ابحثي عن خدمة أو صالون أو منطقة" />
                <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary/90">اكتشفي</button>
              </div>
            </div>
          </div>
        </section>

        <section id="discover" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionTitle title="وش يناسبك اليوم؟" action={<Link to="/bookings" className="flex items-center gap-1 text-sm text-primary">عرض الكل <ArrowLeft className="size-4" /></Link>} />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map((category) => (
              <button key={category.id} className="rounded-2xl border border-border bg-card p-4 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                <span className="text-2xl">{category.emoji}</span>
                <span className="mt-2 block text-sm font-medium">{category.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="how" className="bg-muted/40 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionTitle title="اختاري حسب مزاجك" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {INTENTS.map((intent) => (
                <button key={intent.id} className="rounded-2xl border border-border bg-background p-5 text-right hover:border-primary/40">
                  <span className="text-2xl">{intent.emoji}</span>
                  <h3 className="mt-3 font-semibold">{intent.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{intent.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionTitle title="أماكن موثوقة حولك" action={<Link to="/bookings" className="flex items-center gap-1 text-sm text-primary">استكشفي المزيد <ArrowLeft className="size-4" /></Link>} />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SALONS.slice(0, 6).map((salon) => <SalonCard key={salon.id} salon={salon} />)}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Glam Saudi · جمالك، بطريقتك
      </footer>
    </div>
  );
}

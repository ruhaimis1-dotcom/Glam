import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin, Search, Sparkles, Star } from "lucide-react";
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
    <div className="min-h-screen bg-[#fbf8f5] text-[#2c172b]" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-[#eadfda] bg-[#fbf8f5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <img src="/glam/glam-wordmark-berry.png" alt="Glam" className="h-8 w-auto" />
          <nav className="hidden items-center gap-7 text-sm text-[#745e70] md:flex">
            <a href="#discover" className="hover:text-[#8c285d]">اكتشفي</a>
            <a href="#salons" className="hover:text-[#8c285d]">الصالونات</a>
            <a href="#how" className="hover:text-[#8c285d]">كيف تعمل Glam؟</a>
          </nav>
          <Link to="/bookings" className="rounded-full border border-[#8c285d]/30 px-4 py-2 text-sm font-medium text-[#8c285d] hover:bg-[#f4e8ee]">تسجيل الدخول</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
          <div className="mx-auto grid max-w-7xl items-end gap-8 lg:grid-cols-[1.05fr_.95fr]">
            <div className="order-2 pb-4 lg:order-1 lg:pb-12">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#f4e8ee] px-3 py-1.5 text-sm text-[#8c285d]"><Sparkles className="size-4" /> جمالك، على وقتك</div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.2] tracking-tight sm:text-6xl">اكتشفي المكان الأقرب لذوقك.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#745e70]">قارني الأعمال الحقيقية، التقييمات، الأسعار والمواعيد المتاحة في مكان واحد.</p>
              <div className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-[#eadfda] bg-white p-2 shadow-sm">
                <Search className="mx-2 size-5 text-[#9d8997]" />
                <input className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none" placeholder="ابحثي عن خدمة أو صالون أو منطقة" />
                <button className="rounded-xl bg-[#8c285d] px-5 py-3 font-semibold text-white hover:bg-[#702047]">اكتشفي</button>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#745e70]"><span className="flex items-center gap-1"><MapPin className="size-4 text-[#8c285d]" /> الرياض</span><span>•</span><span>حجز واضح وموثوق</span></div>
            </div>
            <div className="order-1 relative h-[360px] overflow-hidden rounded-[2rem] lg:order-2 lg:h-[500px]"><img src="/glam/glam-salon-hero.png" alt="تجربة عناية داخل صالون عصري" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#2c172b]/70 via-transparent to-transparent" /><div className="absolute bottom-6 right-6 left-6 flex items-end justify-between text-white"><div><p className="text-sm text-white/75">صالون مميز</p><h2 className="mt-1 text-2xl font-semibold">دار لمسة بيوتي</h2></div><span className="rounded-full bg-white/15 px-3 py-2 text-sm backdrop-blur">العليا، الرياض</span></div></div>
          </div>
        </section>

        <section id="discover" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <SectionTitle title="وش يناسبك اليوم؟" action={<Link to="/bookings" className="flex items-center gap-1 text-sm text-primary">عرض الكل <ArrowLeft className="size-4" /></Link>} />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map((category) => (
              <button key={category.id} className="rounded-2xl border border-[#eadfda] bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-[#8c285d]/40 hover:shadow-sm">
                <span className="text-2xl">{category.emoji}</span>
                <span className="mt-2 block text-sm font-medium">{category.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="how" className="bg-[#f4eee9] px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle title="اختاري حسب مزاجك" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {INTENTS.map((intent) => (
                <button key={intent.id} className="rounded-2xl border border-[#eadfda] bg-[#fbf8f5] p-5 text-right hover:border-[#8c285d]/40">
                  <span className="text-2xl">{intent.emoji}</span>
                  <h3 className="mt-3 font-semibold">{intent.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{intent.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="salons" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <SectionTitle title="أماكن موثوقة حولك" action={<Link to="/bookings" className="flex items-center gap-1 text-sm text-primary">استكشفي المزيد <ArrowLeft className="size-4" /></Link>} />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SALONS.slice(0, 6).map((salon) => <SalonCard key={salon.id} salon={salon} />)}
          </div>
          <div className="mt-10 grid gap-4 rounded-3xl bg-[#2c172b] p-6 text-white sm:grid-cols-3"><div className="flex items-center gap-3"><CalendarDays className="size-5 text-[#e3a1bc]" /><span>مواعيد حية وواضحة</span></div><div className="flex items-center gap-3"><Star className="size-5 text-[#e3a1bc]" /><span>تقييمات من عميلات حقيقيات</span></div><div className="flex items-center gap-3"><Sparkles className="size-5 text-[#e3a1bc]" /><span>تجربة Glam المنزلية</span></div></div>
        </section>
      </main>

      <footer className="border-t border-[#eadfda] px-5 py-8 text-center text-sm text-[#745e70]">
        Glam Saudi · جمالك، بطريقتك
      </footer>
    </div>
  );
}

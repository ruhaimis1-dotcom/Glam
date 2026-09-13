import { useMemo, useState } from "react";
import { Search, MapPin, Sparkles, ShieldCheck, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { CustomerShell } from "@/components/glam/shells";
import { Button } from "@/components/ui/button";
import { CATEGORIES, INTENTS, SALONS, type CategoryId } from "@/data/mock";
import { SalonCard } from "@/components/glam/ui";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [intent, setIntent] = useState<string | null>(null);

  const salons = useMemo(() => SALONS.filter((salon) => {
    const matchesCategory = category === "all" || salon.categories.includes(category);
    const text = `${salon.name} ${salon.tagline} ${salon.area} ${salon.district}`.toLowerCase();
    return matchesCategory && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [category, query]);

  return (
    <CustomerShell>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-plum-deep via-plum to-rose px-5 py-8 text-primary-foreground shadow-lift md:px-10 md:py-12">
        <div className="absolute -left-16 -top-20 size-64 rounded-full bg-rose-gold/20 blur-3xl" />
        <div className="absolute -bottom-24 right-10 size-72 rounded-full bg-rose/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
            <Sparkles className="size-3.5" /> جمالك بطريقتك
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight md:text-5xl">وش تبين اليوم؟</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/75 md:text-base">
            اكتشفي المكان والخبرة والموعد المناسب لك — بوضوح، وخصوصية، ومن غير حيرة.
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-card p-2 text-foreground shadow-lift">
            <Search className="mx-2 size-5 shrink-0 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="مثال: بالاياج اليوم شمال الرياض" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" aria-label="ابحثي عن خدمة أو صالون" />
            <Button variant="gold" size="sm" className="hidden sm:inline-flex">ابحثي</Button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/70"><MapPin className="size-4 text-rose-gold" /> الرياض <button className="underline underline-offset-4 hover:text-white">غيّري الموقع</button></div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-medium text-rose-gold-foreground">ابدئي من نيتك</p><h2 className="mt-1 text-2xl font-extrabold">اختاري اللي يناسبك</h2></div><span className="hidden text-sm text-muted-foreground md:inline">Glam يعرفك أكثر مع كل زيارة</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {INTENTS.map((item) => <button key={item.id} onClick={() => setIntent(intent === item.id ? null : item.id)} className={`glam-card p-4 text-right transition-all hover:-translate-y-1 hover:shadow-lift ${intent === item.id ? "border-primary bg-rose-soft shadow-lift" : ""}`}><span className="text-2xl">{item.emoji}</span><h3 className="mt-3 font-bold">{item.label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.hint}</p></button>)}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-rose-gold-foreground">اكتشفي القريب منك</p><h2 className="mt-1 text-2xl font-extrabold">خدمات الجمال في الرياض</h2></div><Button variant="outline" size="sm" className="hidden sm:inline-flex"><SlidersHorizontal className="size-4" /> فلاتر</Button></div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCategory("all")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${category === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>الكل</button>
          {CATEGORIES.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${category === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>{item.emoji} {item.label}</button>)}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {salons.map((salon) => <SalonCard key={salon.id} salon={salon} />)}
        </div>
        {salons.length === 0 && <div className="glam-card mt-4 p-10 text-center"><h3 className="font-bold">ما لقينا نتيجة مطابقة</h3><p className="mt-2 text-sm text-muted-foreground">جرّبي كلمة مختلفة أو اختاري فئة أخرى.</p><Button variant="soft" className="mt-4" onClick={() => { setQuery(""); setCategory("all"); }}>مسح البحث</Button></div>}
      </section>

      <section className="my-10 grid gap-4 rounded-3xl border border-rose-gold/20 bg-rose-soft/50 p-5 md:grid-cols-3 md:p-7">
        <div className="md:col-span-2"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-5" /><span className="text-sm font-bold">خصوصيتك جزء من الحجز</span></div><h2 className="mt-2 text-xl font-extrabold">اختاري تجربتك براحتك</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">موظفات فقط، غرفة خاصة، بدون تصوير، وعدم استخدام الصور تسويقيًا — خيارات واضحة قبل تأكيد الموعد.</p></div>
        <div className="flex items-end md:justify-end"><Button variant="glam" className="w-full md:w-auto">اكتشفي الصالونات <ArrowLeft className="size-4" /></Button></div>
      </section>
    </CustomerShell>
  );
}

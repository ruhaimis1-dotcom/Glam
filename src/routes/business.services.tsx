import { createFileRoute } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
export const Route = createFileRoute("/business/services")({ component: ServicesPage });
function ServicesPage(){return <BusinessShell><PageHeader title="الخدمات" desc="الخدمات والأسعار المعروضة للعميلات" action={<button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">إضافة خدمة</button>}/><div className="grid gap-3 sm:grid-cols-2">{["بالاياج كامل — 650 ر.س","قص وتصفيف — 180 ر.س","مكياج سهرة — 350 ر.س","تسريحة مناسبة — 280 ر.س"].map(x=><div className="glam-card flex items-center gap-3 p-4" key={x}><Scissors className="size-5 text-primary"/><span>{x}</span><span className="mr-auto text-xs text-success">نشطة</span></div>)}</div></BusinessShell>}

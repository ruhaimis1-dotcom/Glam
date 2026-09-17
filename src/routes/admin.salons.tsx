import { createFileRoute } from "@tanstack/react-router";
import { Building2, ShieldCheck } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { SALONS } from "@/data/mock";
export const Route = createFileRoute("/admin/salons")({ component: AdminSalonsPage });
function AdminSalonsPage(){return <AdminShell><PageHeader title="الصالونات والاعتماد" desc="الجهات المسجلة في Glam"/><div className="grid gap-3">{SALONS.slice(0,6).map(s=><div className="glam-card flex items-center gap-3 p-4" key={s.id}><Building2 className="size-5 text-primary"/><div><p className="font-bold">{s.name}</p><p className="text-sm text-muted-foreground">{s.area} · {s.district}</p></div><span className="mr-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success"><ShieldCheck className="size-3"/> معتمد</span></div>)}</div></AdminShell>}

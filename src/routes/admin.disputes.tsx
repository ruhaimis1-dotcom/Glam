import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
export const Route = createFileRoute("/admin/disputes")({ component: AdminDisputesPage });
function AdminDisputesPage(){return <AdminShell><PageHeader title="النزاعات" desc="الحالات التي تحتاج مراجعة"/><div className="grid gap-3">{["النتيجة لا تطابق الصورة المتفق عليها · نور بيوتي لاونج","إلغاء من الصالون قبل ساعة بدون إشعار · نيل بار الرياض","خلاف على استرداد العربون · لوميير ستوديو"].map(x=><div className="glam-card flex items-center gap-3 p-4" key={x}><AlertTriangle className="size-5 text-warning"/><span>{x}</span><button className="mr-auto rounded-full border px-3 py-1.5 text-xs">مراجعة</button></div>)}</div></AdminShell>}

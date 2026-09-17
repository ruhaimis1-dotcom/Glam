import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
export const Route = createFileRoute("/business/schedule")({ component: SchedulePage });
function SchedulePage(){return <BusinessShell><PageHeader title="جدول اليوم" desc="المواعيد المجدولة في لوميير ستوديو" /><div className="glam-card divide-y">{["10:00 ص — هند ع. — بالاياج كامل","1:00 م — ريم س. — قص وتصفيف","4:00 م — بدور ق. — مكياج سهرة","8:00 م — لمى ح. — تسريحة مناسبة"].map(x=><div className="flex items-center gap-3 p-4" key={x}><Clock className="size-4 text-primary"/><span>{x}</span><span className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success">مؤكد</span></div>)}</div></BusinessShell>}

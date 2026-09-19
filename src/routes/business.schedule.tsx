import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/business/schedule")({ component: SchedulePage });
function SchedulePage(){const fallback=["10:00 ص — هند ع. — بالاياج كامل","1:00 م — ريم س. — قص وتصفيف","4:00 م — بدور ق. — مكياج سهرة","8:00 م — لمى ح. — تسريحة مناسبة"]; const [rows,setRows]=useState(fallback); useEffect(()=>{supabase.from("glam_appointments").select("starts_at,service_name,status").eq("salon_name","لوميير ستوديو").order("starts_at").then(({data})=>{if(data?.length)setRows(data.map(a=>`${new Date(a.starts_at).toLocaleTimeString("ar-SA",{hour:"numeric",minute:"2-digit"})} — ${a.service_name}`))})},[]); return <BusinessShell><PageHeader title="جدول اليوم" desc="المواعيد المجدولة في لوميير ستوديو" /><div className="glam-card divide-y">{rows.map(x=><div className="flex items-center gap-3 p-4" key={x}><Clock className="size-4 text-primary"/><span>{x}</span><span className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success">مؤكد</span></div>)}</div></BusinessShell>}

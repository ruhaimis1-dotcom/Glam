import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/admin/bookings")({ component: AdminBookingsPage });
function AdminBookingsPage(){const fallback=["GS-1081 · لوميير ستوديو · اليوم 5:30 م","GS-1080 · نيل بار الرياض · اليوم 7:00 م","GS-1079 · سكينة سبا · غداً 2:00 م"]; const [rows,setRows]=useState(fallback); useEffect(()=>{supabase.from("glam_reservations").select("id,status,created_at").order("created_at",{ascending:false}).limit(20).then(({data})=>{if(data?.length)setRows(data.map((r,i)=>`${r.id?.slice(0,8)??`GS-${i}`} · حجز عميلة · ${r.status??"مؤكد"}`))})},[]); return <AdminShell><PageHeader title="الحجوزات" desc="سجل الحجوزات في المنصة"/><div className="glam-card divide-y">{rows.map(x=><div className="flex items-center gap-3 p-4" key={x}><CalendarCheck className="size-5 text-primary"/><span>{x}</span><span className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success">مؤكد</span></div>)}</div></AdminShell>}

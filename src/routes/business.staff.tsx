import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
export const Route = createFileRoute("/business/staff")({ component: StaffPage });
function StaffPage(){return <BusinessShell><PageHeader title="الموظفات" desc="فريق العمل والتخصصات"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{["سارة العتيبي — خبيرة شعر","نورة القحطاني — خبيرة مكياج","ريم الشهري — خبيرة أظافر"].map(x=><div className="glam-card flex items-center gap-3 p-4" key={x}><span className="grid size-11 place-items-center rounded-full glam-gradient text-white"><Users className="size-5"/></span><span>{x}</span></div>)}</div></BusinessShell>}

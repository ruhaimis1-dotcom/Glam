import { createFileRoute } from "@tanstack/react-router";
import { Building2, ShieldCheck } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { SALONS } from "@/data/mock";
import { useEffect, useState } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/admin/salons")({ component: AdminSalonsPage });
function AdminSalonsPage() {
  const [approved, setApproved] = useState<Record<string, boolean>>(() =>
    readStored("glam-salon-approvals", Object.fromEntries(SALONS.map((s) => [s.id, true]))),
  );
  const [pageIds, setPageIds] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase
      .from("glam_salon_pages")
      .select("organization_id,title,published")
      .then(({ data }) => {
        if (!data?.length) return;
        const ids: Record<string, string> = {};
        const states = { ...approved };
        for (const page of data) {
          const salon = SALONS.find((item) => page.title?.includes(item.name));
          if (salon) {
            ids[salon.id] = page.organization_id;
            states[salon.id] = page.published;
          }
        }
        setPageIds(ids);
        setApproved(states);
        writeStored("glam-salon-approvals", states);
      });
  }, []);
  const toggle = async (id: string) => {
    const next = { ...approved, [id]: !approved[id] };
    setApproved(next);
    writeStored("glam-salon-approvals", next);
    if (pageIds[id])
      await supabase
        .from("glam_salon_pages")
        .update({ published: next[id] })
        .eq("organization_id", pageIds[id]);
  };
  return (
    <AdminShell>
      <PageHeader title="الصالونات والاعتماد" desc="الجهات المسجلة في Glam" />
      <div className="grid gap-3">
        {SALONS.slice(0, 6).map((s) => (
          <div className="glam-card flex items-center gap-3 p-4" key={s.id}>
            <Building2 className="size-5 text-primary" />
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {s.area} · {s.district}
              </p>
            </div>
            <button
              onClick={() => toggle(s.id)}
              className={`mr-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${approved[s.id] ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
            >
              <ShieldCheck className="size-3" />
              {approved[s.id] ? "معتمد" : "موقوف"}
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

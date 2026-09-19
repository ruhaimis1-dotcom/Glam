/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase rows are runtime-shaped until generated types are added. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganization } from "@/lib/glam-org";
export const Route = createFileRoute("/business/services")({ component: ServicesPage });
function ServicesPage() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [services, setServices] = useState<string[]>(() =>
    readStored("glam-services", [
      "بالاياج كامل — 650 ر.س",
      "قص وتصفيف — 180 ر.س",
      "مكياج سهرة — 350 ر.س",
      "تسريحة مناسبة — 280 ر.س",
    ]),
  );
  useEffect(() => {
    getCurrentOrganization().then(({ organizationId }) => {
      if (!organizationId) return;
      supabase
        .from("glam_services")
        .select("name,price_sar")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name")
        .then(({ data }) => {
          if (data?.length) {
            const rows = data.map((s: any) => `${s.name} — ${s.price_sar} ر.س`);
            setServices(rows);
            writeStored("glam-services", rows);
          }
        });
    });
  }, []);
  const save = async () => {
    if (!name.trim() || !price) return;
    const { organizationId } = await getCurrentOrganization();
    const { error } = organizationId
      ? await supabase.from("glam_services").insert({
          organization_id: organizationId,
          name: name.trim(),
          price_sar: Number(price),
          minutes: 60,
          active: true,
          revision: 1,
        })
      : { error: new Error("No organization") };
    if (error) {
      const next = [...services, `${name.trim()} — ${price} ر.س`];
      setServices(next);
      writeStored("glam-services", next);
    } else setServices([...services, `${name.trim()} — ${price} ر.س`]);
    setName("");
    setPrice("");
    setAdding(false);
  };
  return (
    <BusinessShell>
      <PageHeader
        title="الخدمات"
        desc="الخدمات والأسعار المعروضة للعميلات"
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            إضافة خدمة
          </button>
        }
      />
      {adding && (
        <section className="glam-card mb-4 space-y-3 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="اسم الخدمة"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="السعر بالريال"
            type="number"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              حفظ الخدمة
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-full border px-4 py-2 text-sm"
            >
              إلغاء
            </button>
          </div>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((x) => (
          <div className="glam-card flex items-center gap-3 p-4" key={x}>
            <Scissors className="size-5 text-primary" />
            <span>{x}</span>
            <span className="mr-auto text-xs text-success">نشطة</span>
          </div>
        ))}
      </div>
    </BusinessShell>
  );
}

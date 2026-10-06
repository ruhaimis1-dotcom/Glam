import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import {
  createClient360Repository,
  type ClientContact,
} from "@/repositories/client-360";

export const Route = createFileRoute("/business/clients")({ component: ClientsPage });
const repository = createClient360Repository(supabase);

function ClientsPage() {
  const organization = useBusinessOrganization();
  const [clients, setClients] = useState<ClientContact[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "disabled" | "error">("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void repository
      .list(organization.id)
      .then((value) => {
        if (!active) return;
        setClients(value);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(
          error instanceof Error && error.message === "CLIENT_360_NOT_ENABLED"
            ? "disabled"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [organization.id]);

  return (
    <BusinessShell>
      <PageHeader
        title="العميلات"
        desc="ملف موحد للحجوزات والخدمات والمتابعة داخل الصالون"
      />
      <div className="mt-6 space-y-3">
        {status === "loading" && <p role="status">جارٍ تحميل العميلات…</p>}
        {status === "disabled" && (
          <div className="glam-card p-6">
            <h2 className="font-semibold">Client 360 قيد التجهيز</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              الواجهة جاهزة مبدئيًا، ولن نعرض أو نحفظ بيانات قبل اعتماد طبقة العزل وقاعدة البيانات
              ضمن بوابة الـMVP.
            </p>
          </div>
        )}
        {status === "error" && <p role="alert">تعذر تحميل العميلات.</p>}
        {status === "ready" &&
          clients.map((client) => (
            <Link
              key={client.id}
              to="/business/clients/$clientId"
              params={{ clientId: client.id }}
              className="glam-card block p-5 hover:border-primary"
            >
              <h2 className="font-semibold">{client.displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {client.phone ?? client.email ?? "لا توجد وسيلة تواصل"}
              </p>
            </Link>
          ))}
        {status === "ready" && !clients.length && (
          <div className="glam-card p-6 text-sm text-muted-foreground">
            لا توجد عميلات في سجل الصالون حتى الآن.
          </div>
        )}
      </div>
    </BusinessShell>
  );
}

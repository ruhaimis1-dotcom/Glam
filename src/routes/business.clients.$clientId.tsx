import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessShell } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import { createClient360Repository, type ClientContact } from "@/repositories/client-360";
import {
  createClientTimelineRepository,
  type ClientTimelineItem,
} from "@/repositories/client-timeline";

export const Route = createFileRoute("/business/clients/$clientId")({
  component: Client360Page,
});
const contacts = createClient360Repository(supabase);
const timeline = createClientTimelineRepository(supabase);

function Client360Page() {
  const { clientId } = Route.useParams();
  const organization = useBusinessOrganization();
  const [contact, setContact] = useState<ClientContact | null>(null);
  const [items, setItems] = useState<ClientTimelineItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "disabled" | "error">("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void Promise.all([
      contacts.get(organization.id, clientId),
      timeline.list(organization.id, clientId),
    ])
      .then(([client, events]) => {
        if (!active) return;
        setContact(client);
        setItems(events);
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
  }, [clientId, organization.id]);

  return (
    <BusinessShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/business/clients"
            aria-label="العودة للعميلات"
            className="grid size-9 place-items-center rounded-full border bg-card"
          >
            <ArrowRight className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{contact?.displayName ?? "ملف العميلة"}</h1>
            <p className="text-sm text-muted-foreground">Client 360 · {organization.name}</p>
          </div>
        </div>

        {status === "loading" && <p role="status">جارٍ تحميل ملف العميلة…</p>}
        {status === "disabled" && (
          <section className="glam-card p-6">
            <h2 className="font-semibold">Client 360 قيد التجهيز</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              لن نعرض بيانات تشغيلية قبل اعتماد طبقة العزل وواجهات القراءة ضمن بوابة الـMVP.
            </p>
          </section>
        )}
        {status === "error" && <p role="alert">تعذر تحميل ملف العميلة.</p>}

        {status === "ready" && contact && (
          <>
            <section className="glam-card grid gap-4 p-6 md:grid-cols-3">
              <Info label="الجوال" value={contact.phone ?? "غير مسجل"} dir="ltr" />
              <Info label="البريد" value={contact.email ?? "غير مسجل"} dir="ltr" />
              <Info label="حساب قلام" value={contact.linkedCustomerId ? "مرتبط" : "غير مرتبط"} />
            </section>

            <section className="glam-card flex gap-3 p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">جواز الجمال والخصوصية</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ملف الصالون لا يحتوي نسخة من جواز الجمال. الوصول لأي بيانات منه يعتمد على موافقة
                  العميلة الفعالة ونطاقها.
                </p>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <section className="glam-card p-6">
                <h2 className="font-semibold">السجل</h2>
                <div className="mt-4 space-y-4">
                  {items.map((item) => (
                    <article
                      key={`${item.kind}-${item.id}`}
                      className="border-b pb-4 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          {item.detail && (
                            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                          )}
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {new Date(item.occurredAt).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    </article>
                  ))}
                  {!items.length && (
                    <p className="text-sm text-muted-foreground">لا يوجد نشاط مسجل حتى الآن.</p>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <Placeholder title="الوسوم" text="تصنيف العميلة للمتابعة والتجزئة." />
                <Placeholder title="المتابعة" text="المهام القادمة والعميلات المتوقفات." />
                <Placeholder title="ملاحظات الصالون" text="ملاحظات تشغيلية يملكها الصالون." />
              </aside>
            </div>
          </>
        )}
      </div>
    </BusinessShell>
  );
}

function Info({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium" dir={dir}>
        {value}
      </p>
    </div>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="glam-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <p className="mt-3 text-xs text-muted-foreground">قيد التجهيز ضمن P4.</p>
    </section>
  );
}

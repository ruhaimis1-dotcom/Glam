import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
import {
  createPassportConsentRepository,
  type PassportConsent,
  type PassportScope,
} from "@/repositories/passport-consent";

export const Route = createFileRoute("/beauty-passport/consents")({
  component: PassportConsentsPage,
});
const repository = createPassportConsentRepository(supabase);

const labels: Record<PassportScope, string> = {
  profile: "بيانات الجمال الأساسية",
  sensitivities: "الحساسيات والمنتجات غير المناسبة",
  service_history: "سجل الخدمات والنتائج",
  preferences: "تفضيلات الزيارة والخصوصية",
  photos: "صور قبل وبعد",
};

function PassportConsentsPage() {
  const [items, setItems] = useState<PassportConsent[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "disabled" | "anonymous" | "error">(
    "loading",
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void repository
      .list()
      .then((value) => {
        if (!active) return;
        setItems(value);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(
          error instanceof Error && error.message === "CONSENT_NOT_ENABLED"
            ? "disabled"
            : error instanceof Error && error.message === "AUTH_REQUIRED"
              ? "anonymous"
              : "error",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function revoke(item: PassportConsent) {
    if (busy) return;
    setBusy(item.id);
    setNotice("");
    try {
      await repository.revoke(item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setNotice(`تم إيقاف مشاركة جوازك مع ${item.organizationName}.`);
    } catch {
      setNotice("لم يتم تأكيد سحب الموافقة. لم نغيّر حالة المشاركة المعروضة.");
    } finally {
      setBusy("");
    }
  }

  return (
    <CustomerShell title="إدارة المشاركة">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/beauty-passport"
            aria-label="العودة لجواز الجمال"
            className="grid size-9 place-items-center rounded-full border bg-card"
          >
            <ArrowRight className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">إدارة المشاركة</h1>
            <p className="text-sm text-muted-foreground">أنتِ تتحكمين بمن يرى جواز جمالك.</p>
          </div>
        </div>

        <section className="glam-card flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            الحجز وحده لا يمنح الصالون صلاحية جوازك. صور قبل وبعد تحتاج موافقة مستقلة ضمن نطاق المشاركة.
          </p>
        </section>

        {status === "loading" && <p role="status">جارٍ تحميل الموافقات…</p>}
        {status === "anonymous" && <p>سجّلي الدخول لإدارة مشاركة جوازك.</p>}
        {status === "disabled" && (
          <p className="glam-card p-6">إدارة الموافقات قيد التجهيز قبل بوابة الـMVP.</p>
        )}
        {status === "error" && <p role="alert">تعذر تحميل الموافقات.</p>}

        {status === "ready" && (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="glam-card space-y-4 p-5">
                <div>
                  <h2 className="font-semibold">{item.organizationName}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    تمت الموافقة: {new Date(item.grantedAt).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.scopes.map((scope) => (
                    <span key={scope} className="rounded-full border px-3 py-1 text-xs">
                      {labels[scope]}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void revoke(item)}
                  className="rounded-full border px-4 py-2 text-sm disabled:opacity-50"
                >
                  {busy === item.id ? "جارٍ سحب الموافقة…" : "إيقاف المشاركة"}
                </button>
              </article>
            ))}
            {!items.length && (
              <div className="glam-card p-6 text-sm text-muted-foreground">
                لا توجد مشاركات نشطة لجواز جمالك.
              </div>
            )}
          </div>
        )}

        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>
    </CustomerShell>
  );
}

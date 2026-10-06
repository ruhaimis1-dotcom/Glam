import { createFileRoute } from "@tanstack/react-router";
import { MailPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import { inviteStaff, listStaff, type StaffMember } from "@/repositories/staff";

export const Route = createFileRoute("/business/staff")({ component: StaffPage });

function StaffPage() {
  const organization = useBusinessOrganization();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      setStaff(await listStaff(supabase, organization.id));
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.message === "TEAM_DIRECTORY_NOT_ENABLED"
          ? "دليل الفريق يحتاج تفعيل طبقة الـMVP قبل الاستخدام."
          : "تعذر تحميل فريق العمل. أعيدي المحاولة.",
      );
    }
  }, [organization.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!email.trim().includes("@")) {
      setMessage("أدخلي بريدًا إلكترونيًا صحيحًا للموظفة.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      await inviteStaff(supabase, organization.id, email);
      setEmail("");
      setAdding(false);
      setStatus("ready");
      setMessage("تم إنشاء دعوة الأخصائية. ستظهر في الفريق بعد قبول الدعوة.");
    } catch {
      setStatus("error");
      setMessage("تعذر إنشاء الدعوة. تحققي من البريد أو حالة الدعوة الحالية.");
    }
  };

  return (
    <BusinessShell>
      <PageHeader
        title="الموظفات"
        desc="إدارة الأخصائيات المرتبطات فعليًا بحسابات الفريق"
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            دعوة أخصائية
          </button>
        }
      />

      {message && (
        <p role="status" className="mb-4 rounded-xl border bg-card p-3 text-sm">
          {message}
        </p>
      )}

      {adding && (
        <section className="glam-card mb-4 space-y-3 p-4">
          <label className="block text-sm font-medium">
            البريد الإلكتروني
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              placeholder="name@example.com"
              dir="ltr"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            تنشأ عضوية الأخصائية فقط بعد قبول الدعوة وتسجيل الدخول بالحساب المطابق.
          </p>
          <div className="flex gap-2">
            <button
              disabled={status === "saving"}
              onClick={() => void save()}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {status === "saving" ? "جارٍ إنشاء الدعوة…" : "إرسال الدعوة"}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-full border px-4 py-2 text-sm">
              إلغاء
            </button>
          </div>
        </section>
      )}

      {status === "loading" ? (
        <p role="status">جارٍ تحميل فريق العمل…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <article className="glam-card flex items-center gap-3 p-4" key={member.id}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full glam-gradient text-white">
                <Users className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{member.name}</h2>
                <p className="text-sm text-muted-foreground">{member.specialty}</p>
              </div>
            </article>
          ))}
          {!staff.length && status !== "error" && (
            <div className="glam-card p-6 text-sm text-muted-foreground">
              لا توجد أخصائيات مقبولات في الفريق بعد.
            </div>
          )}
        </div>
      )}

      <section className="glam-card mt-5 flex gap-3 p-4 text-sm text-muted-foreground">
        <MailPlus className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          ربط الأخصائية بالخدمات وأوقات الدوام يستخدم بنية قلام الحالية بعد قبول الدعوة، ولا يتم
          إنشاء موظفة محلية منفصلة عن حساب الفريق.
        </p>
      </section>
    </BusinessShell>
  );
}

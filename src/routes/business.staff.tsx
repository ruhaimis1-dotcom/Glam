import { createFileRoute } from "@tanstack/react-router";
import { UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import { createStaff, listStaff, setStaffActive, type StaffMember } from "@/repositories/staff";

export const Route = createFileRoute("/business/staff")({ component: StaffPage });

function StaffPage() {
  const organization = useBusinessOrganization();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      setStaff(await listStaff(supabase, organization.id));
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("تعذر تحميل فريق العمل. أعيدي المحاولة.");
    }
  }, [organization.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (name.trim().length < 2 || specialty.trim().length < 2) {
      setMessage("أدخلي اسم الموظفة والتخصص.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const member = await createStaff(supabase, organization.id, { name, specialty, phone });
      setStaff((current) =>
        [...current, member].sort((a, b) => a.name.localeCompare(b.name, "ar")),
      );
      setName("");
      setSpecialty("");
      setPhone("");
      setAdding(false);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("تعذر حفظ الموظفة. تحققي من البيانات وأعيدي المحاولة.");
    }
  };

  const toggle = async (member: StaffMember) => {
    setMessage("");
    try {
      const updated = await setStaffActive(supabase, organization.id, member.id, !member.active);
      setStaff((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setMessage("تعذر تحديث حالة الموظفة.");
    }
  };

  return (
    <BusinessShell>
      <PageHeader
        title="الموظفات"
        desc="إدارة فريق الصالون والتخصصات وحالة التوفر"
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            إضافة موظفة
          </button>
        }
      />

      {message && (
        <p role="alert" className="mb-4 rounded-xl border bg-card p-3 text-sm">
          {message}
        </p>
      )}

      {adding && (
        <section className="glam-card mb-4 space-y-3 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="اسم الموظفة"
          />
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="التخصص"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="رقم الجوال — اختياري"
            inputMode="tel"
          />
          <div className="flex gap-2">
            <button
              disabled={status === "saving"}
              onClick={() => void save()}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {status === "saving" ? "جارٍ الحفظ…" : "حفظ"}
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
                {member.phone && (
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {member.phone}
                  </p>
                )}
              </div>
              <button
                onClick={() => void toggle(member)}
                className="rounded-full border p-2"
                aria-label={member.active ? `تعطيل ${member.name}` : `تفعيل ${member.name}`}
                title={member.active ? "تعطيل" : "تفعيل"}
              >
                {member.active ? (
                  <UserRoundCheck className="size-4" />
                ) : (
                  <UserRoundX className="size-4" />
                )}
              </button>
            </article>
          ))}
          {!staff.length && status !== "error" && (
            <div className="glam-card p-6 text-sm text-muted-foreground">
              لا توجد موظفات مضافات بعد.
            </div>
          )}
        </div>
      )}
    </BusinessShell>
  );
}

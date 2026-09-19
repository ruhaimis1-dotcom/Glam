import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/business/staff")({ component: StaffPage });
type StaffRow = { id?: string; name: string; role: string };
const defaults: StaffRow[] = [
  { name: "سارة العتيبي", role: "خبيرة شعر" },
  { name: "نورة القحطاني", role: "خبيرة مكياج" },
  { name: "ريم الشهري", role: "خبيرة أظافر" },
];

function StaffPage() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>(() => readStored("glam-business-staff", defaults));

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from("glam_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!membership?.organization_id) return;
      setOrganizationId(membership.organization_id);
      const { data } = await supabase
        .from("glam_team_members")
        .select("id,name,role")
        .eq("organization_id", membership.organization_id)
        .eq("active", true)
        .order("created_at");
      if (data?.length) setStaff(data);
    });
  }, []);

  const save = async () => {
    if (!name.trim() || !role.trim()) return;
    const row = { name: name.trim(), role: role.trim() };
    let saved: StaffRow = row;
    if (organizationId) {
      const { data } = await supabase
        .from("glam_team_members")
        .insert({
          ...row,
          organization_id: organizationId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select("id,name,role")
        .single();
      if (data) saved = data;
    }
    const next = [...staff, saved];
    setStaff(next);
    writeStored("glam-business-staff", next);
    setName("");
    setRole("");
    setAdding(false);
  };

  const remove = async (person: StaffRow) => {
    if (person.id)
      await supabase.from("glam_team_members").update({ active: false }).eq("id", person.id);
    const next = staff.filter((x) => x !== person);
    setStaff(next);
    writeStored("glam-business-staff", next);
  };

  return (
    <BusinessShell>
      <PageHeader
        title="الموظفات"
        desc="فريق العمل والتخصصات"
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            إضافة موظفة
          </button>
        }
      />
      {adding && (
        <section className="glam-card mb-4 space-y-3 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="اسم الموظفة"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3"
            placeholder="التخصص"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              حفظ
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((x) => (
          <div
            className="glam-card flex items-center gap-3 p-4"
            key={x.id ?? `${x.name}-${x.role}`}
          >
            <span className="grid size-11 place-items-center rounded-full glam-gradient text-white">
              <Users className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              {x.name} — {x.role}
            </span>
            <button
              onClick={() => remove(x)}
              className="text-xs text-destructive"
              aria-label={`حذف ${x.name}`}
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </BusinessShell>
  );
}

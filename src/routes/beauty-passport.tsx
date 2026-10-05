import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
import {
  createBeautyPassportRepository,
  type BeautyPassport,
} from "@/repositories/beauty-passport";

export const Route = createFileRoute("/beauty-passport")({ component: BeautyPassportPage });
const repository = createBeautyPassportRepository(supabase);

function BeautyPassportPage() {
  const [passport, setPassport] = useState<BeautyPassport | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "disabled" | "anonymous" | "error">(
    "loading",
  );
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const empty = useMemo<BeautyPassport | null>(() => null, []);

  useEffect(() => {
    let active = true;
    void repository
      .load()
      .then(async (value) => {
        if (!active) return;
        if (value) {
          setPassport(value);
          setStatus("ready");
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        if (!data.user) {
          setStatus("anonymous");
          return;
        }
        setPassport({
          customerId: data.user.id,
          hair: {},
          skin: {},
          nails: {},
          sensitivities: [],
          preferences: {},
          customerNotes: "",
        });
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(
          error instanceof Error && error.message === "PASSPORT_NOT_ENABLED"
            ? "disabled"
            : error instanceof Error && error.message === "AUTH_REQUIRED"
              ? "anonymous"
              : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [empty]);

  const setField = (
    section: "hair" | "skin" | "nails" | "preferences",
    key: string,
    value: string,
  ) =>
    setPassport((current) =>
      current ? { ...current, [section]: { ...current[section], [key]: value } } : current,
    );

  async function save() {
    if (!passport || saving) return;
    setSaving(true);
    setNotice("");
    try {
      setPassport(await repository.save(passport));
      setNotice("تم حفظ جواز جمالك.");
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === "PASSPORT_NOT_ENABLED"
          ? "جواز الجمال ما زال في مرحلة التجهيز قبل إطلاق الـMVP."
          : "تعذر حفظ جواز الجمال. حاولي مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <CustomerShell title="جواز جمالك">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            aria-label="العودة للملف"
            className="grid size-9 place-items-center rounded-full border bg-card"
          >
            <ArrowRight className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">جواز جمالك</h1>
            <p className="text-sm text-muted-foreground">تفاصيلك لك، ومشاركتها بقرارك.</p>
          </div>
        </div>

        <section className="glam-card flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            لا تتم مشاركة هذا الملف مع أي صالون تلقائيًا عند الحجز. أنتِ تختارين ما تتم
            مشاركته ويمكنك سحب الموافقة لاحقًا.
          </p>
        </section>

        <Link
          to="/beauty-passport/consents"
          className="inline-block text-sm font-medium text-primary"
        >
          إدارة المشاركة والموافقات
        </Link>

        {status === "loading" && <p role="status">جارٍ تحميل جوازك…</p>}
        {status === "anonymous" && <p>سجّلي الدخول أولًا لإنشاء جواز جمالك.</p>}
        {status === "disabled" && (
          <section className="glam-card p-6">
            <h2 className="font-semibold">الميزة قيد التجهيز</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              جهزنا رحلة جواز الجمال، لكن لن نحفظ أي بيانات قبل اعتماد طبقة الخصوصية
              والأمان ضمن بوابة الـMVP.
            </p>
          </section>
        )}
        {status === "error" && <p role="alert">تعذر تحميل جواز الجمال.</p>}

        {status === "ready" && passport && (
          <>
            <PassportSection title="الشعر">
              <TextField
                label="نوع أو طبيعة الشعر"
                value={String(passport.hair["type"] ?? "")}
                onChange={(value) => setField("hair", "type", value)}
              />
              <TextField
                label="ملاحظات اللون أو الصبغة"
                value={String(passport.hair["colorNotes"] ?? "")}
                onChange={(value) => setField("hair", "colorNotes", value)}
              />
            </PassportSection>
            <PassportSection title="البشرة">
              <TextField
                label="نوع البشرة"
                value={String(passport.skin["type"] ?? "")}
                onChange={(value) => setField("skin", "type", value)}
              />
              <TextField
                label="ملاحظات أو حساسية"
                value={String(passport.skin["notes"] ?? "")}
                onChange={(value) => setField("skin", "notes", value)}
              />
            </PassportSection>
            <PassportSection title="الأظافر">
              <TextField
                label="تفضيلاتك"
                value={String(passport.nails["preferences"] ?? "")}
                onChange={(value) => setField("nails", "preferences", value)}
              />
            </PassportSection>
            <PassportSection title="الحساسيات والمنتجات غير المناسبة">
              <textarea
                value={passport.sensitivities.join("\n")}
                onChange={(event) =>
                  setPassport({
                    ...passport,
                    sensitivities: event.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                className="min-h-28 w-full rounded-2xl border bg-background px-4 py-3"
                placeholder="كل حساسية أو منتج في سطر مستقل"
              />
            </PassportSection>
            <PassportSection title="تفضيلات الزيارة">
              <TextField
                label="الخصوصية أو الغرفة الخاصة"
                value={String(passport.preferences["privacy"] ?? "")}
                onChange={(value) => setField("preferences", "privacy", value)}
              />
              <TextField
                label="المدة المفضلة"
                value={String(passport.preferences["duration"] ?? "")}
                onChange={(value) => setField("preferences", "duration", value)}
              />
            </PassportSection>
            <button
              disabled={saving}
              onClick={() => void save()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ جواز الجمال"}
            </button>
            {notice && (
              <p role="status" className="text-sm">
                {notice}
              </p>
            )}
          </>
        )}
      </div>
    </CustomerShell>
  );
}

function PassportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glam-card space-y-4 p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border bg-background px-4 py-3"
      />
    </label>
  );
}

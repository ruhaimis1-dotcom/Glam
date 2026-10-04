import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { EmptyState } from "@/components/glam/ui";
import { supabase } from "@/lib/supabase";
import {
  createCustomerProfileRepository,
  type CustomerProfile,
} from "@/repositories/customer-profile";

export const Route = createFileRoute("/profile")({ component: ProfilePage });
const repository = createCustomerProfileRepository(supabase);
function ProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "anonymous" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const lifecycle = generation;
    function refresh() {
      const ticket = ++generation.current;
      setProfile(null);
      setName("");
      setNotice("");
      setSaving(false);
      setStatus("loading");
      void Promise.resolve().then(async () => {
        try {
          const value = await repository.load();
          if (!active || ticket !== generation.current) return;
          setProfile(value);
          setName(value.displayName);
          setStatus("ready");
        } catch (error) {
          if (active && ticket === generation.current)
            setStatus(
              error instanceof Error && error.message === "AUTH_REQUIRED" ? "anonymous" : "error",
            );
        }
      });
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(refresh);
    refresh();
    return () => {
      active = false;
      lifecycle.current++;
      subscription.unsubscribe();
    };
  }, [attempt]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    const ticket = generation.current;
    setSaving(true);
    setNotice("");
    try {
      const saved = await repository.save(profile.userId, name);
      if (ticket !== generation.current) return;
      setProfile(saved);
      setName(saved.displayName);
      setNotice("تم حفظ اسمك.");
    } catch {
      if (ticket === generation.current) setNotice("تعذر الحفظ. تحققي من الاتصال وحاولي مرة أخرى.");
    } finally {
      if (ticket === generation.current) setSaving(false);
    }
  }
  return (
    <CustomerShell title="ملفي">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          aria-label="العودة للرئيسية"
          className="grid size-9 place-items-center rounded-full border bg-card"
        >
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">ملفي</h1>
          <p className="text-sm text-muted-foreground">خلّينا نتعرف عليك</p>
        </div>
      </div>
      {status === "loading" && <p role="status">جارٍ تحميل ملفك…</p>}
      {status === "anonymous" && (
        <EmptyState
          icon={UserRound}
          title="ملفك يبدأ من هنا"
          desc="سجّلي الدخول لإضافة اسمك."
          action={
            <Link
              to="/login"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              تسجيل الدخول
            </Link>
          }
        />
      )}
      {status === "error" && (
        <div role="alert" className="glam-card space-y-4 p-6">
          <p>تعذر تحميل ملفك.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {status === "ready" && (
        <form onSubmit={submit} className="glam-card max-w-xl space-y-5 p-6">
          <label className="block text-sm font-medium">
            اسمك
            <input
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border bg-background px-4 py-3"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ…" : "حفظ الاسم"}
          </button>
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
        </form>
      )}
    </CustomerShell>
  );
}

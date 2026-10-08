import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { listBusinessOrganizations, type BusinessOrganization } from "@/lib/business-access";
import { BusinessContext } from "@/lib/business-context";

export function BusinessAccess({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<BusinessOrganization[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "error" | "login">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      const request = ++generation.current;
      setStatus("loading");
      setOrganizations([]);
      setSelected("");
      void listBusinessOrganizations(supabase)
        .then((orgs) => {
          if (!mounted || request !== generation.current) return;
          setOrganizations(orgs);
          setSelected(orgs.length === 1 ? orgs[0]!.id : "");
          setStatus(orgs.length ? "ready" : "denied");
        })
        .catch((error: unknown) => {
          if (mounted && request === generation.current)
            setStatus(
              error instanceof Error && error.message === "AUTH_REQUIRED" ? "login" : "error",
            );
        });
    };
    refresh();
    // Do not await Supabase operations inside its auth callback.
    const { data } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [attempt]);

  if (status !== "ready")
    return (
      <main dir="rtl" className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-bold">GLAM Business</h1>
        <p role={status === "loading" ? "status" : "alert"}>
          {status === "loading"
            ? "جارٍ التحقق من صلاحيات المؤسسة…"
            : status === "login"
              ? "سجّلي الدخول للوصول إلى لوحة الصالون."
              : status === "denied"
                ? "هذه اللوحة متاحة لمالكة المؤسسة أو مديرتها فقط."
                : "تعذر التحقق من الصلاحيات. أعيدي المحاولة."}
        </p>
        {status === "error" && (
          <button onClick={() => setAttempt(attempt + 1)}>إعادة المحاولة</button>
        )}
        {status === "login" && (
          <Link to="/login" className="text-primary">
            تسجيل الدخول
          </Link>
        )}
        <Link to="/" className="block text-primary">
          تطبيق العميلة
        </Link>
      </main>
    );
  const organization = organizations.find((org) => org.id === selected);
  return (
    <>
      {organizations.length > 1 && (
        <label className="block border-b bg-card p-3 text-sm">
          المؤسسة الحالية{" "}
          <select
            aria-label="المؤسسة الحالية"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded-xl border p-2"
          >
            <option value="">اختاري المؤسسة</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {organization && (
        <BusinessContext.Provider
          key={`${generation.current}:${organization.id}`}
          value={organization}
        >
          {children}
        </BusinessContext.Provider>
      )}
    </>
  );
}

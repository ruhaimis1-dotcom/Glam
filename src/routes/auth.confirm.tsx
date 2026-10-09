import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/confirm")({ component: AuthConfirmPage });

function AuthConfirmPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function confirmRecovery() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const next = params.get("next") || "/reset-password";

      if (!tokenHash || type !== "recovery") {
        if (!cancelled) setError("رابط الاستعادة غير صالح. اطلبي رابطًا جديدًا.");
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (cancelled) return;

      if (verifyError) {
        setError("تعذر التحقق من رابط الاستعادة أو انتهت صلاحيته. اطلبي رابطًا جديدًا.");
        return;
      }

      void navigate({ to: next === "/reset-password" ? "/reset-password" : "/reset-password" });
    }

    void confirmRecovery();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]">
      <div className="mx-auto max-w-md">
        <section className="mt-24 rounded-3xl border border-[#eadfda] bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#8c285d]">Glam</p>
          <h1 className="mt-2 text-2xl font-bold">التحقق من رابط الاستعادة</h1>
          {error ? (
            <div className="mt-5 space-y-4">
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
              <a
                href="/reset-password"
                className="inline-block rounded-2xl bg-[#5A1835] px-5 py-3 font-semibold text-white"
              >
                طلب رابط جديد
              </a>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#745e70]">جارٍ التحقق من الرابط الآمن…</p>
          )}
        </section>
      </div>
    </main>
  );
}

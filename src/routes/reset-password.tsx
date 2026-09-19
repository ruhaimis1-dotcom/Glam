import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setRecovery(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) return setError("تعذر إرسال رابط الاستعادة. تحققي من البريد وحاولي مرة أخرى.");
    setMessage("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.");
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("يجب أن تتكون كلمة المرور من 8 أحرف أو أكثر.");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return setError("تعذر تحديث كلمة المرور. افتحي الرابط الأخير من البريد مرة أخرى.");
    setMessage("تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.");
    setTimeout(() => navigate({ to: "/login" }), 900);
  }

  return <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]"><div className="mx-auto max-w-md"><Link to="/login" className="mb-10 inline-flex items-center gap-2 text-sm text-[#745e70]"><ArrowRight className="size-4" /> العودة للدخول</Link><section className="rounded-3xl border border-[#eadfda] bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-[#8c285d]">Glam</p><h1 className="mt-2 text-3xl font-bold">استعادة كلمة المرور</h1><p className="mt-2 text-sm text-[#745e70]">{recovery ? "اكتبي كلمة مرور جديدة لحسابك." : "أدخلي بريد الحساب لإرسال رابط آمن."}</p>{recovery ? <form onSubmit={updatePassword} className="mt-8 space-y-4"><label className="block text-sm font-medium">كلمة المرور الجديدة<div className="relative mt-2"><LockKeyhole className="absolute right-4 top-3.5 size-4 text-[#9b8795]" /><input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] py-3 pl-4 pr-11 outline-none focus:border-[#8c285d]" /></div></label><button className="w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white">حفظ كلمة المرور</button></form> : <form onSubmit={requestReset} className="mt-8 space-y-4"><label className="block text-sm font-medium">البريد الإلكتروني<div className="relative mt-2"><Mail className="absolute right-4 top-3.5 size-4 text-[#9b8795]" /><input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] py-3 pl-4 pr-11 outline-none focus:border-[#8c285d]" /></div></label><button className="w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white">إرسال رابط الاستعادة</button></form>}{message && <p className="mt-4 text-sm text-green-700">{message}</p>}{error && <p className="mt-4 text-sm text-red-700">{error}</p>}</section></div></main>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) return void setError("أدخلي البريد الإلكتروني وكلمة المرور للمتابعة.");
    setError("");
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (register) {
        const { data, error: signupError } = await supabase.auth.signUp({ email: normalized, password });
        if (signupError) {
          setError(signupError.code === "weak_password" ? "اختاري كلمة مرور أقوى." : "تعذر إنشاء الحساب. تحققي من البيانات وحاولي لاحقًا، أو سجّلي الدخول إذا كان لديك حساب.");
          return;
        }
        setPassword("");
        if (data.session) return void navigate({ to: "/bookings" });
        setNotice("راجعي بريدك لتأكيد الحساب إن لم يكن مسجلاً من قبل، ثم عودي لتسجيل الدخول.");
        setRegister(false);
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (authError) return void setError("تعذر تسجيل الدخول. تحققي من البيانات أو فعّلي الحساب أولاً.");
      if (normalized === "saud@hirely.sa") return void navigate({ to: "/admin" });
      if (normalized === "ruhaimi.s1@gmail.com") return void navigate({ to: "/business" });
      return void navigate({ to: "/bookings" });
    } catch {
      setError("تعذر الاتصال. حاولي مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]"><div className="mx-auto max-w-md"><Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-[#745e70]"><ArrowRight className="size-4" /> العودة للرئيسية</Link><section className="rounded-3xl border border-[#eadfda] bg-white p-6 shadow-sm sm:p-8"><div className="mb-8"><p className="text-sm font-semibold text-[#8c285d]">Glam</p><h1 className="mt-2 text-3xl font-bold">{register ? "إنشاء حساب عميلة" : "تسجيل الدخول"}</h1><p className="mt-2 text-sm text-[#745e70]">ادخلي إلى حسابك لمتابعة حجوزاتك وإدارتها.</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">البريد الإلكتروني<input value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" type="email" placeholder="name@example.com" className="mt-2 w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] px-4 py-3 outline-none focus:border-[#8c285d]" /></label><label className="block text-sm font-medium">كلمة المرور<div className="relative mt-2"><LockKeyhole className="absolute right-4 top-3.5 size-4 text-[#9b8795]" /><input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={register ? 8 : undefined} autoComplete={register ? "new-password" : "current-password"} type="password" className="w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] py-3 pl-4 pr-11 outline-none focus:border-[#8c285d]" /></div></label>{notice && <p role="status" className="text-sm text-[#5A1835]">{notice}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} type="submit" className="w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white hover:bg-[#3D0F26]">{busy ? "جارٍ المتابعة…" : register ? "إنشاء الحساب" : "دخول"}</button><button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(""); setNotice(""); setPassword(""); }} className="w-full py-2 text-sm font-semibold text-[#8c285d]">{register ? "لديك حساب؟ سجّلي الدخول" : "عميلة جديدة؟ أنشئي حسابًا"}</button></form><p className="mt-5 text-center text-xs text-[#745e70]"><Mail className="mr-1 inline size-3.5" /> نسخة تجريبية للربط الأولي</p></section></div></main>;
}

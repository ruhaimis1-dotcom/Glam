import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listBusinessOrganizations } from "@/lib/business-access";
import { resolvePostLogin } from "@/lib/post-login";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [notice, setNotice] = useState("");
  const [retryUserId, setRetryUserId] = useState<string | null>(null);
  const alive = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    setInteractive(true);
    return () => { alive.current = false; };
  }, []);

  async function openAccount(userId: string) {
    try {
      const to = await resolvePostLogin({
        identity: () => supabase.auth.getUser(),
        admin: () => supabase.rpc("glam_admin_overview"),
        businesses: () => listBusinessOrganizations(supabase),
      }, userId, () => alive.current);
      if (alive.current) await navigate({ to, replace: true });
    } catch {
      if (alive.current) {
        setRetryUserId(userId);
        setError("تم تسجيل الدخول، لكن تعذر تحديد واجهة حسابك. أعيدي محاولة فتح الحساب.");
      }
    }
  }

  async function retryAccess() {
    if (!interactive || !retryUserId || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await openAccount(retryUserId); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password)
      return void setError("أدخلي البريد الإلكتروني وكلمة المرور للمتابعة.");
    if (!interactive || lock.current) return;
    lock.current = true;
    setError(""); setBusy(true); setNotice(""); setRetryUserId(null);
    try {
      if (register) {
        const { data, error: signupError } = await supabase.auth.signUp({ email: normalized, password });
        if (!alive.current) return;
        if (signupError) {
          setError(signupError.code === "weak_password"
            ? "اختاري كلمة مرور أقوى."
            : "تعذر إنشاء الحساب. تحققي من البيانات وحاولي لاحقًا، أو سجّلي الدخول إذا كان لديك حساب.");
          return;
        }
        setPassword("");
        if (data.session && data.user) return void await openAccount(data.user.id);
        setNotice("راجعي بريدك لتأكيد الحساب إن لم يكن مسجلاً من قبل، ثم عودي لتسجيل الدخول.");
        setRegister(false);
        return;
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (!alive.current) return;
      if (authError || !data.user || !data.session)
        return void setError("تعذر تسجيل الدخول. تحققي من البيانات أو فعّلي الحساب أولاً.");
      setPassword("");
      await openAccount(data.user.id);
    } catch {
      if (alive.current) setError("تعذر الاتصال. حاولي مرة أخرى.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-[#745e70]">
          <ArrowRight className="size-4" /> العودة للرئيسية
        </Link>
        <section className="rounded-3xl border border-[#eadfda] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold text-[#8c285d]">Glam</p>
            <h1 className="mt-2 text-3xl font-bold">{register ? "إنشاء حساب عميلة" : "تسجيل الدخول"}</h1>
            <p className="mt-2 text-sm text-[#745e70]">ادخلي إلى حسابك لمتابعة حجوزاتك وإدارتها.</p>
          </div>
          <form onSubmit={submit} aria-busy={!interactive || busy} className="space-y-4">
            {!interactive && <p role="status" className="text-sm text-[#745e70]">جارٍ تجهيز تسجيل الدخول…</p>}
            <label className="block text-sm font-medium">
              البريد الإلكتروني
              <input value={email} onChange={(event) => { setEmail(event.target.value); setRetryUserId(null); }}
                required autoComplete="email" type="email" placeholder="name@example.com" disabled={!interactive || busy}
                className="mt-2 w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] px-4 py-3 outline-none focus:border-[#8c285d]" />
            </label>
            <label className="block text-sm font-medium">
              كلمة المرور
              <div className="relative mt-2">
                <LockKeyhole className="absolute right-4 top-3.5 size-4 text-[#9b8795]" />
                <input value={password} onChange={(event) => setPassword(event.target.value)} required
                  minLength={register ? 8 : undefined} autoComplete={register ? "new-password" : "current-password"}
                  type="password" disabled={!interactive || busy}
                  className="w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] py-3 pl-4 pr-11 outline-none focus:border-[#8c285d]" />
              </div>
            </label>
            {!register && <div className="-mt-1 flex justify-start">
              <Link to="/reset-password" className="text-sm font-semibold text-[#8c285d] hover:text-[#5A1835]">نسيت كلمة المرور؟</Link>
            </div>}
            {notice && <p role="status" className="text-sm text-[#5A1835]">{notice}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {retryUserId && <button type="button" onClick={() => void retryAccess()} disabled={!interactive || busy}
              className="w-full rounded-2xl border border-[#8c285d] px-5 py-3 font-semibold text-[#8c285d]">إعادة محاولة فتح الحساب</button>}
            <button disabled={!interactive || busy} type="submit" className="w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white hover:bg-[#3D0F26]">
              {busy ? "جارٍ المتابعة…" : register ? "إنشاء الحساب" : "دخول"}
            </button>
            <button type="button" disabled={!interactive || busy} onClick={() => {
              setRegister(!register); setError(""); setNotice(""); setPassword(""); setRetryUserId(null);
            }} className="w-full py-2 text-sm font-semibold text-[#8c285d]">
              {register ? "لديك حساب؟ سجّلي الدخول" : "عميلة جديدة؟ أنشئي حسابًا"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { getRecoveryClient } from "@/lib/supabase";
import {
  createRecoveryActions,
  parseRecoveryLink,
  recoveryMessage,
  type RecoveryLink,
  type RecoveryResult,
} from "@/lib/recovery-flow";

type Phase = "loading" | "confirm" | "request" | "ready" | "saved";
const inputClass = "mt-2 w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] px-4 py-3 outline-none focus:border-[#8c285d]";
const buttonClass = "w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white disabled:opacity-50";

export function PasswordRecovery({ confirmLink = false }: { confirmLink?: boolean }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const initial = useRef<RecoveryLink | null>(null);
  const token = useRef<string | null>(null);
  const account = useRef<string | null>(null);
  const alive = useRef(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const actions = useRef<ReturnType<typeof createRecoveryActions> | null>(null);

  useEffect(() => {
    alive.current = true;
    let active = true;
    actions.current ??= createRecoveryActions(getRecoveryClient().auth);

    function applyLink(link: RecoveryLink) {
      const revision = ++generation.current;
      token.current = link.kind === "confirm" ? link.tokenHash : null;
      account.current = null;
      setPassword("");
      setConfirmation("");
      setError("");
      setMessage("");
      // replaceState does not emit hashchange; retain the parsed link for StrictMode.
      if (window.location.search || window.location.hash)
        window.history.replaceState(window.history.state, "", window.location.pathname);
      if (link.kind === "confirm") {
        setPhase("confirm");
      } else if (link.kind === "error" || confirmLink) {
        setError(recoveryMessage(link.kind === "error" ? link.code : "invalid_link"));
        setPhase("request");
      } else {
        setPhase("loading");
        void actions.current!.resume().then((result) => {
          if (!active || revision !== generation.current) return;
          if (result.kind === "ready") {
            account.current = result.userId;
            setPhase("ready");
          } else {
            if (result.kind === "error" && result.code !== "busy")
              setError(recoveryMessage(result.code));
            setPhase("request");
          }
        });
      }
    }

    function incomingLink() {
      // A second email link can arrive as same-document fragment navigation.
      // It must invalidate the old form/result, not reuse a previously parsed link.
      const path = window.location.pathname.replace(/\/+$/, "");
      if (path !== "/auth/confirm" && path !== "/reset-password") return;
      if (!window.location.search && !window.location.hash) return;
      initial.current = parseRecoveryLink(window.location.search, window.location.hash);
      applyLink(initial.current);
    }

    initial.current ??= parseRecoveryLink(window.location.search, window.location.hash);
    window.addEventListener("hashchange", incomingLink);
    window.addEventListener("popstate", incomingLink);
    applyLink(initial.current);
    return () => {
      active = false;
      alive.current = false;
      generation.current++;
      window.removeEventListener("hashchange", incomingLink);
      window.removeEventListener("popstate", incomingLink);
    };
  }, [confirmLink]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function run(action: () => Promise<RecoveryResult>, complete: (result: RecoveryResult) => void) {
    if (lock.current) return;
    lock.current = true;
    const revision = generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (alive.current && revision === generation.current) complete(result);
    } catch {
      if (alive.current && revision === generation.current) setError(recoveryMessage("unavailable"));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function verify() {
    if (!actions.current || !token.current || lock.current) return;
    const value = token.current;
    token.current = null;
    void run(() => actions.current!.verify(value), (result) => {
      if (result.kind === "ready") {
        account.current = result.userId;
        setPhase("ready");
        if (confirmLink) void navigate({ to: "/reset-password", replace: true });
      } else {
        setError(recoveryMessage(result.kind === "error" ? result.code : "invalid_link"));
        setPhase("request");
      }
    });
  }

  function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actions.current || cooldown || lock.current) return;
    void run(() => actions.current!.request(email, window.location.origin), (result) => {
      if (result.kind === "sent") {
        setMessage("إذا كان البريد مرتبطًا بحساب في قلام، فستصلك رسالة استعادة كلمة المرور. راجعي أحدث رسالة.");
        setCooldown(60);
      } else if (result.kind === "error") {
        setError(recoveryMessage(result.code));
        if (result.code === "rate_limited") setCooldown(60);
      }
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actions.current || !account.current || lock.current) return;
    const userId = account.current;
    void run(() => actions.current!.save(userId, password, confirmation), (result) => {
      if (result.kind === "saved") {
        setPassword("");
        setConfirmation("");
        account.current = null;
        setPhase("saved");
        setMessage(result.signedOut
          ? "تم تحديث كلمة المرور بنجاح. سجّلي الدخول بكلمة المرور الجديدة."
          : "تم تحديث كلمة المرور. تعذر تأكيد إغلاق جلسة الاستعادة؛ أغلقي هذه النافذة ثم سجّلي الدخول.");
      } else if (result.kind === "error") {
        setError(recoveryMessage(result.code));
        if (result.code === "account_changed" || result.code === "expired_link") {
          setPassword(""); setConfirmation(""); account.current = null; setPhase("request");
        }
      }
    });
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]">
      <div className="mx-auto max-w-md">
        <Link to="/login" className="mb-10 inline-flex items-center gap-2 text-sm text-[#745e70]">
          <ArrowRight className="size-4" /> العودة للدخول
        </Link>
        <section className="rounded-3xl border border-[#eadfda] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#8c285d]">Glam</p>
          <h1 className="mt-2 text-3xl font-bold">
            {phase === "ready" ? "تعيين كلمة مرور جديدة" : "استعادة كلمة المرور"}
          </h1>
          {phase === "loading" && <p role="status" className="mt-5">جارٍ التحقق من جلسة الاستعادة…</p>}
          {phase === "confirm" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-[#745e70]">اضغطي للمتابعة إلى تعيين كلمة المرور. فتح هذه الصفحة وحده لا يستهلك رابط الاستعادة.</p>
              <button type="button" disabled={busy} onClick={verify} className={buttonClass}>
                {busy ? "جارٍ التحقق…" : "المتابعة لتعيين كلمة المرور"}
              </button>
            </div>
          )}
          {phase === "request" && (
            <form onSubmit={request} className="mt-6 space-y-4">
              <p className="text-sm text-[#745e70]">أدخلي بريد الحساب لإرسال رابط آمن.</p>
              <label className="block text-sm font-medium">
                البريد الإلكتروني
                <input required type="email" autoComplete="email" value={email}
                  onChange={(event) => setEmail(event.target.value)} className={inputClass} disabled={busy} />
              </label>
              <button type="submit" disabled={busy || cooldown > 0} className={buttonClass}>
                {busy ? "جارٍ إرسال الطلب…" : cooldown ? `إعادة الإرسال بعد ${cooldown} ثانية` : "إرسال رابط الاستعادة"}
              </button>
            </form>
          )}
          {phase === "ready" && (
            <form onSubmit={save} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                كلمة المرور الجديدة
                <input required minLength={8} type="password" autoComplete="new-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} className={inputClass} disabled={busy} />
              </label>
              <label className="block text-sm font-medium">
                تأكيد كلمة المرور الجديدة
                <input required minLength={8} type="password" autoComplete="new-password" value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)} className={inputClass} disabled={busy} />
              </label>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
              </button>
            </form>
          )}
          {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          {phase === "saved" && <Link to="/login" className="mt-5 inline-block font-semibold text-[#8c285d]">تسجيل الدخول</Link>}
        </section>
      </div>
    </main>
  );
}

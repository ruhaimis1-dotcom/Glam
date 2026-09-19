import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) return void setError("أدخلي البريد الإلكتروني وكلمة المرور للمتابعة.");
    if (normalized === "saud@hirely.sa") return void navigate({ to: "/business" });
    if (normalized === "7sayef.1@gmail.com") return void navigate({ to: "/admin" });
    return void navigate({ to: "/bookings" });
  }

  return <main dir="rtl" className="min-h-screen bg-[#fbf8f5] px-4 py-8 text-[#2c1725]"><div className="mx-auto max-w-md"><Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-[#745e70]"><ArrowRight className="size-4" /> العودة للرئيسية</Link><section className="rounded-3xl border border-[#eadfda] bg-white p-6 shadow-sm sm:p-8"><div className="mb-8"><p className="text-sm font-semibold text-[#8c285d]">Glam</p><h1 className="mt-2 text-3xl font-bold">تسجيل الدخول</h1><p className="mt-2 text-sm text-[#745e70]">ادخلي إلى حسابك لمتابعة حجوزاتك وإدارتها.</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">البريد الإلكتروني<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" className="mt-2 w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] px-4 py-3 outline-none focus:border-[#8c285d]" /></label><label className="block text-sm font-medium">كلمة المرور<div className="relative mt-2"><LockKeyhole className="absolute right-4 top-3.5 size-4 text-[#9b8795]" /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-2xl border border-[#eadfda] bg-[#fbf8f5] py-3 pl-4 pr-11 outline-none focus:border-[#8c285d]" /></div></label>{error && <p className="text-sm text-red-700">{error}</p>}<button type="submit" className="w-full rounded-2xl bg-[#5A1835] px-5 py-3.5 font-semibold text-white hover:bg-[#3D0F26]">دخول</button></form><p className="mt-5 text-center text-xs text-[#745e70]"><Mail className="mr-1 inline size-3.5" /> نسخة تجريبية للربط الأولي</p></section></div></main>;
}

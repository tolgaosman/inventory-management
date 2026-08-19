"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import browserLogo from "@/assets/browserLogo.png";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const linkInvalid = !email || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword({ email, token, password, passwordConfirmation });
      setDone(true);
      setTimeout(() => router.push("/giris"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre sıfırlanamadı, bağlantının süresi dolmuş olabilir.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full rounded-[32px] bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl p-8 sm:p-10 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-slate-800/50 relative overflow-hidden transition-colors">
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-[48px] items-center justify-center">
            <Image src={browserLogo} alt="Envanter Yönetimi" className="h-full w-auto object-contain" priority />
          </div>
          <div className="text-[1.35rem] font-semibold tracking-tighter mt-1 whitespace-nowrap">
            <span className="text-[#0a1629] dark:text-white">Envanter</span>{" "}
            <span className="text-[#14b8a6]">Yönetimi</span>
          </div>
        </div>

        <p className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400 max-w-[280px]">
          {done ? "Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…" : "Hesabınız için yeni bir şifre belirleyin."}
        </p>

        {linkInvalid ? (
          <div
            role="alert"
            className="flex w-full items-start gap-2 rounded-2xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Bağlantı geçersiz. Lütfen şifremi unuttum sayfasından yeni bir bağlantı isteyin.</span>
          </div>
        ) : done ? (
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Yeni şifre"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border-0 bg-slate-100/80 dark:bg-slate-900/80 py-3 pl-10 pr-10 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Yeni şifre (tekrar)"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full rounded-2xl border-0 bg-slate-100/80 dark:bg-slate-900/80 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 py-6 text-sm font-semibold text-white shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-all mt-2"
            >
              {isLoading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </Button>
          </form>
        )}

        <div className="mt-8 flex justify-center">
          <Link
            href="/giris"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

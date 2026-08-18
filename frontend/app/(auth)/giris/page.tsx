"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import browserLogo from "@/assets/browserLogo.png";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      router.push("/panel");
    }, 800);
  };

  return (
    <div className="w-full rounded-[32px] bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl p-8 sm:p-10 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-slate-800/50 relative overflow-hidden transition-colors">
      
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo and App Name */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-[48px] items-center justify-center">
            <Image 
              src={browserLogo} 
              alt="Envanter Yönetimi" 
              className="h-full w-auto object-contain"
              priority
            />
          </div>
          <div className="text-[1.35rem] font-semibold tracking-tighter mt-1 whitespace-nowrap">
            <span className="text-[#0a1629] dark:text-white">Envanter</span>{" "}
            <span className="text-[#14b8a6]">Yönetimi</span>
          </div>
        </div>


        {/* Headings */}
        <p className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400 max-w-[280px]">
          Envanterinizi yönetin, stok hareketlerini takip edin ve tedarik zincirinizi tek bir noktadan kontrol edin.
        </p>
        <form onSubmit={handleLogin} className="w-full space-y-4">
          
          {/* Email Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="email"
              placeholder="E-posta"
              required
              className="w-full rounded-2xl border-0 bg-slate-100/80 dark:bg-slate-900/80 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Şifre"
              required
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

          <div className="flex justify-end pt-1">
            <Link 
              href="/sifremi-unuttum" 
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Şifremi unuttum
            </Link>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 py-6 text-sm font-semibold text-white shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-all mt-2"
          >
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>

      </div>
    </div>
  );
}

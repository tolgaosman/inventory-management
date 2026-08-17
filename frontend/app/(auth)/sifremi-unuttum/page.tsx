"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 800);
  };

  return (
    <div className="w-full rounded-[32px] bg-white/70 backdrop-blur-xl p-8 sm:p-10 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] border border-white/50 relative overflow-hidden">
      
      {/* Soft top gradient */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-6 flex h-16 items-center justify-center">
          <Image 
            src="/siteLogo.png" 
            alt="Site Logo" 
            width={180} 
            height={64}
            className="h-full w-auto object-contain"
            priority
          />
        </div>

        {/* Headings */}
        <p className="mb-8 text-center text-sm text-slate-500 max-w-[280px]">
          {isSent 
            ? "E-posta adresinize bir şifre sıfırlama bağlantısı gönderdik." 
            : "E-posta adresinizi girin, size şifrenizi sıfırlamanız için bir bağlantı gönderelim."}
        </p>

        {/* Form */}
        {!isSent ? (
          <form onSubmit={handleReset} className="w-full space-y-4">
            
            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                placeholder="E-posta adresi"
                required
                className="w-full rounded-2xl border-0 bg-slate-100/80 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full rounded-xl bg-slate-900 py-6 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition-all mt-4"
            >
              {isLoading ? "Gönderiliyor..." : "Bağlantıyı Gönder"}
            </Button>
          </form>
        ) : (
          <div className="w-full">
            <Button 
              type="button" 
              onClick={() => setIsSent(false)}
              variant="outline"
              className="w-full rounded-xl py-6 text-sm font-semibold shadow-sm mt-4 border-slate-200"
            >
              Başka bir e-posta dene
            </Button>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link 
            href="/giris" 
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş sayfasına dön
          </Link>
        </div>

      </div>
    </div>
  );
}

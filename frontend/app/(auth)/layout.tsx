import React from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#E5F1FC] dark:bg-slate-950 transition-colors duration-500">
      {/* Background decoration: Soft cloudy sky aesthetic */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Soft radial gradients representing light and clouds */}
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-white/40 dark:bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[900px] h-[900px] rounded-full bg-white/60 dark:bg-slate-800/30 blur-[140px]" />
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] rounded-full bg-blue-100/50 dark:bg-blue-950/40 blur-[100px]" />
        
        {/* Subtle radial grid or rings (like in the reference) */}
        <div className="absolute w-[1200px] h-[1200px] rounded-full border border-white/20 dark:border-white/5" />
        <div className="absolute w-[900px] h-[900px] rounded-full border border-white/20 dark:border-white/5" />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-white/20 dark:border-white/5" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[420px] px-4">
        {children}
      </div>

      {/* Theme Toggle */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
        <ThemeToggle />
      </div>
    </div>
  );
}

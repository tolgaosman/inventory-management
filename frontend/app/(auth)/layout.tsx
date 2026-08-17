import React from "react";
import Link from "next/link";
import { Package } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#E5F1FC]">
      {/* Background decoration: Soft cloudy sky aesthetic */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Soft radial gradients representing light and clouds */}
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-white/40 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[900px] h-[900px] rounded-full bg-white/60 blur-[140px]" />
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] rounded-full bg-blue-100/50 blur-[100px]" />
        
        {/* Subtle radial grid or rings (like in the reference) */}
        <div className="absolute w-[1200px] h-[1200px] rounded-full border border-white/20" />
        <div className="absolute w-[900px] h-[900px] rounded-full border border-white/20" />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-white/20" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[420px] px-4">
        {children}
      </div>
    </div>
  );
}

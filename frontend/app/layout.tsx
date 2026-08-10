import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Near East Technology — Stok & Envanter Yönetimi",
  description: "Yakın Doğu Teknoloji sunucu, ağ, bilgisayar ve lisans envanter yönetim sistemi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AuthProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

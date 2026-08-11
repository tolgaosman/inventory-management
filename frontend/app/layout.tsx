import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { CurrencyProvider } from "@/lib/currency-context";

import { SettingsProvider } from "@/lib/settings-context";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Stok Yönetimi",
  description: "Yakın Doğu Teknoloji sunucu, ağ, bilgisayar ve lisans envanter yönetim sistemi.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/browserLogo.png", type: "image/png" },
    ],
    shortcut: "/browserLogo.png",
    apple: "/browserLogo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <CurrencyProvider>
            <SettingsProvider>
              <AuthProvider>
                <TooltipProvider delay={150}>{children}</TooltipProvider>
              </AuthProvider>
              <Toaster position="top-center" />
            </SettingsProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

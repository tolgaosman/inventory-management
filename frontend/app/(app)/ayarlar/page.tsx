"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  User,
  Bell,
  Shield,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
  ShoppingCart,
  Wallet,
  Palette,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Section, SectionStack } from "@/components/common/section";
import { cn } from "@/lib/utils";
import { useCurrency, type CurrencyCode } from "@/lib/currency-context";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useSettings } from "@/lib/settings-context";
import { TIMEZONE_OPTIONS } from "@/lib/constants";
import { relativeTimeFromNow } from "@/lib/format";
import { TINTS, type TintName } from "@/lib/tints";
import { LANGUAGE_OPTIONS } from "@/lib/translate";
import type { Role } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

/**
 * Selected-state treatment for a choice pill or card — a bordered version of
 * the matching `TINTS` chip, so options in the same group (theme, currency,
 * role…) stay visually distinct from one another instead of collapsing onto
 * one colour. Mirrors the tone grouping in `lib/tints.ts`.
 */
const TONE_PILL = {
  blue: "border-tint-blue/30 bg-tint-blue/10 text-tint-blue",
  teal: "border-tint-teal/30 bg-tint-teal/10 text-tint-teal",
  plum: "border-tint-plum/30 bg-tint-plum/10 text-tint-plum",
  amber: "border-tint-amber/30 bg-tint-amber/12 text-tint-amber",
  green: "border-tint-green/30 bg-tint-green/10 text-tint-green",
  red: "border-tint-red/30 bg-tint-red/10 text-tint-red",
  neutral: "border-primary/30 bg-primary/10 text-primary",
} as const;

const PILL: Record<TintName | "neutral", string> = {
  blue: TONE_PILL.blue,
  teal: TONE_PILL.teal,
  plum: TONE_PILL.plum,
  amber: TONE_PILL.amber,
  green: TONE_PILL.green,
  red: TONE_PILL.red,
  neutral: TONE_PILL.neutral,
  brand: TONE_PILL.blue,
  positive: TONE_PILL.green,
  warning: TONE_PILL.amber,
  critical: TONE_PILL.red,
  indigo: TONE_PILL.blue,
  sky: TONE_PILL.blue,
  cyan: TONE_PILL.teal,
  violet: TONE_PILL.plum,
  fuchsia: TONE_PILL.plum,
  pink: TONE_PILL.plum,
  orange: TONE_PILL.amber,
  yellow: TONE_PILL.amber,
};

/** Groups a set of `SectionCard`s under a labeled, colored category heading. */
function CategoryHeader({
  icon: Icon,
  tint,
  title,
  description,
}: {
  icon: LucideIcon;
  tint: TintName;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex size-8 items-center justify-center rounded-lg", TINTS[tint])}>
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  tint,
  title,
  description,
  children,
  footer,
  hint,
}: {
  icon: LucideIcon;
  tint: TintName;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="gap-0 flex flex-col justify-between h-full overflow-hidden">
      <div className="flex-1 flex flex-col pt-5 pb-4">
        <CardHeader className="px-6 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
            <div className={cn("flex size-9 items-center justify-center rounded-xl", TINTS[tint])}>
              <Icon className="size-4" />
            </div>
            {title}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground pt-0.5">{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pt-1 flex-1 flex flex-col justify-between">{children}</CardContent>
      </div>
      {(footer || hint) && (
        <CardFooter className="h-12 min-h-[48px] max-h-[48px] py-0 px-6 flex items-center justify-between bg-muted/40 border-t border-border/50 mt-auto shrink-0">
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <span />}
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

/** A single button in a small visual choice group (theme, currency, role, …). */
function OptionCard({
  icon: Icon,
  label,
  sublabel,
  tint,
  selected,
  onClick,
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  tint: TintName | "neutral";
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-xl border text-center transition-all cursor-pointer",
        compact ? "p-2 gap-1.5" : "p-3 gap-2",
        selected ? cn(PILL[tint], "shadow-xs") : "border-border/60 bg-card hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-lg",
          compact ? "size-7" : "size-9",
          tint !== "neutral" ? cn(TINTS[tint], !selected && "opacity-55") : "bg-primary/15 text-primary",
        )}
      >
        <Icon className={compact ? "size-3.5" : "size-4"} />
      </div>
      <span className={cn("text-xs", selected ? "font-semibold" : "font-medium text-muted-foreground")}>
        {label}
      </span>
      {sublabel && <span className="text-micro text-muted-foreground">{sublabel}</span>}
    </button>
  );
}

const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string; tint: TintName }[] = [
  { value: "try", label: "Türk Lirası", symbol: "₺", tint: "green" },
  { value: "usd", label: "Amerikan Doları", symbol: "$", tint: "blue" },
  { value: "eur", label: "Euro", symbol: "€", tint: "violet" },
  { value: "gbp", label: "İngiliz Sterlini", symbol: "£", tint: "pink" },
];

const ROLE_TINTS: Record<Role, TintName> = { yonetici: "blue", satinalma: "violet", depo: "amber" };

const NOTIFICATION_ROWS: {
  id: "notifyStock" | "notifyOrder" | "notifySystem";
  label: string;
  description: string;
  icon: LucideIcon;
  tint: TintName;
}[] = [
  {
    id: "notifyStock",
    label: "Kritik Stok Uyarıları",
    description: "Ürünler kritik stok seviyesinin altına düştüğünde üst çubukta bildir.",
    icon: AlertTriangle,
    tint: "red",
  },
  {
    id: "notifyOrder",
    label: "Yeni Sipariş Uyarıları",
    description: "Yeni bir satın alma siparişi oluşturulduğunda bildir.",
    icon: ShoppingCart,
    tint: "blue",
  },
  {
    id: "notifySystem",
    label: "Sistem Güncellemeleri",
    description: "Planlı bakım ve sistem güncellemeleri hakkında bilgi al.",
    icon: RefreshCw,
    tint: "violet",
  },
];

function passwordStrength(pw: string): { score: number; label: string; tone: "critical" | "warning" | "good" } {
  if (!pw) return { score: 0, label: "", tone: "critical" };
  let points = 0;
  if (pw.length >= 8) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/\d/.test(pw)) points++;
  if (/[^a-zA-Z0-9]/.test(pw)) points++;
  const score = (points / 4) * 100;
  if (points <= 1) return { score, label: "Zayıf", tone: "critical" };
  if (points <= 2) return { score, label: "Orta", tone: "warning" };
  return { score, label: "Güçlü", tone: "good" };
}

export default function SettingsPage() {
  const {
    userProfile,
    notifications,
    timezone,
    language,
    updateUserProfile,
    updateNotifications,
    setTimezone,
    setLanguage,
  } = useSettings();

  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, rates, isLoading, lastUpdated, refreshRates } = useCurrency();

  // Theme is only known after hydration (it depends on localStorage / the OS
  // preference), so the theme picker renders nothing until then to avoid a
  // server/client mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard, must run post-mount
    setMounted(true);
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const strength = passwordStrength(newPassword);

  const securityGuard = useSubmitGuard();

  function handleSecuritySave(formData: FormData) {
    const current = String(formData.get("currentPassword") ?? "");
    const next = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (!current || !next || !confirm) {
      toast.error("Parola güncellenemedi", { description: "Tüm alanları doldurun." });
      return;
    }
    if (next.length < 8) {
      toast.error("Parola güncellenemedi", { description: "Yeni parola en az 8 karakter olmalı." });
      return;
    }
    if (next !== confirm) {
      toast.error("Parola güncellenemedi", { description: "Yeni parola ve tekrarı eşleşmiyor." });
      return;
    }

    securityGuard.guard(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Parola güncellendi.", { description: "Yeni parolanız kaydedildi." });
      setNewPassword("");
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Ayarlar" description="Sistem tercihlerinizi ve hesap bilgilerinizi yönetin." />

      <SectionStack className="space-y-8">
      {/* HESABIM */}
      <Section index={0} className="space-y-3">
        <CategoryHeader icon={User} tint="blue" title="Hesabım" description="Profil bilgileriniz ve parola güvenliği." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-stretch">
          <SectionCard
            icon={User}
            tint="blue"
            title="Profil Bilgileri"
            description="Kişisel bilgilerinizi buradan güncelleyebilirsiniz."
            hint="Değişiklikler anında otomatik kaydedilir."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Ad</Label>
                  <Input
                    id="firstName"
                    value={userProfile.firstName}
                    onChange={(e) => updateUserProfile({ firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input
                    id="lastName"
                    value={userProfile.lastName}
                    onChange={(e) => updateUserProfile({ lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => updateUserProfile({ email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefon Numarası</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={userProfile.phone}
                  onChange={(e) => updateUserProfile({ phone: e.target.value })}
                />
              </div>
            </div>
          </SectionCard>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Parolanız başarıyla güncellendi.");
              e.currentTarget.reset();
            }}
            className="h-full"
          >
            <SectionCard
              icon={Shield}
              tint="plum"
              title="Güvenlik & Parola"
              description="Hesap şifrenizi ve güvenlik tercihlerinizi güncelleyin."
              footer={<SubmitButton pending={false} size="sm">Parolayı Güncelle</SubmitButton>}
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">Mevcut Parola</Label>
                  <Input id="currentPassword" name="currentPassword" type="password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">Yeni Parola</Label>
                  <Input id="newPassword" name="newPassword" type="password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Yeni Parola (Tekrar)</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" />
                </div>
              </div>
            </SectionCard>
          </form>
        </div>
      </Section>

      {/* TERCİHLER */}
      <Section index={1} className="space-y-4">
        <CategoryHeader
          icon={Palette}
          tint="fuchsia"
          title="Tercihler"
          description="Görünüm, bildirim ve para birimi ayarları."
        />

        {/* Row 1: Görünüm & Saat Dilimi + Para Birimi (2 Side-by-Side Cards) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCard
            icon={Sun}
            tint="indigo"
            title="Görünüm & Bölge"
            description="Arayüz teması, dil ve saat dilimi ayarlarını yönetin."
            hint="Değişiklikler anında uygulanır."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Arayüz Teması</Label>
                {mounted ? (
                  <div className="grid grid-cols-3 gap-2">
                    <OptionCard compact icon={Sun} label="Açık" tint="amber" selected={theme === "light"} onClick={() => setTheme("light")} />
                    <OptionCard compact icon={Moon} label="Koyu" tint="indigo" selected={theme === "dark"} onClick={() => setTheme("dark")} />
                    <OptionCard
                      compact
                      icon={Monitor}
                      label="Sistem"
                      tint="neutral"
                      selected={theme === "system"}
                      onClick={() => setTheme("system")}
                    />
                  </div>
                ) : (
                  <Skeleton className="h-[60px] w-full" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 notranslate flex flex-col">
                  <Label className="text-xs font-semibold text-foreground">Arayüz Dili</Label>
                  {mounted ? (
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      {LANGUAGE_OPTIONS.map((l) => (
                        <OptionCard
                          compact
                          key={l.value}
                          icon={() => (
                            <img
                              src={`https://flagcdn.com/w40/${l.value === "en" ? "gb" : l.value}.png`}
                              srcSet={`https://flagcdn.com/w80/${l.value === "en" ? "gb" : l.value}.png 2x`}
                              width="24"
                              alt={l.value.toUpperCase()}
                              className="rounded-[3px]"
                            />
                          )}
                          label={l.value.toUpperCase()}
                          tint="teal"
                          selected={language === l.value}
                          onClick={() => l.value !== language && setLanguage(l.value)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Skeleton className="flex-1 min-h-[60px] w-full" />
                  )}
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-semibold text-foreground">Saat Dilimi</Label>
                  {mounted ? (
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      {TIMEZONE_OPTIONS.map((t) => {
                        const match = t.label.match(/\((.*?)\)\s+(.*)/);
                        const sublabel = match ? match[1] : "";
                        const label = match ? match[2] : t.label;

                        return (
                          <OptionCard
                            compact
                            key={t.value}
                            icon={Globe}
                            label={label}
                            sublabel={sublabel}
                            tint="indigo"
                            selected={timezone === t.value}
                            onClick={() => t.value !== timezone && setTimezone(t.value)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <Skeleton className="h-full min-h-[68px] w-full" />
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Wallet}
            tint="green"
            title="Para Birimi"
            description="Fiyatlar, güncel kurlar üzerinden seçilen para birimine çevrilerek gösterilir."
            hint="Değişiklikler anında uygulanır."
          >
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Para Birimi</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshRates}
                    disabled={isLoading}
                    className="size-6"
                    title="Kurları Merkez Bankası'ndan Güncelle"
                  >
                    <RefreshCw className={cn("size-3", isLoading && "animate-spin")} />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CURRENCY_OPTIONS.map((c) => (
                    <OptionCard
                      compact
                      key={c.value}
                      icon={() => <span className="text-sm font-semibold">{c.symbol}</span>}
                      label={c.value.toUpperCase()}
                      tint={c.tint}
                      selected={currency === c.value}
                      onClick={() => setCurrency(c.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-4 flex flex-wrap items-center justify-between gap-2">
                {rates && (
                  <div className="flex flex-wrap items-center gap-1.5 text-micro font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1">
                      <span className="font-semibold text-foreground">USD:</span> 1 $ = {rates.usd?.toFixed(2)} ₺
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1">
                      <span className="font-semibold text-foreground">EUR:</span> 1 € = {rates.eur?.toFixed(2)} ₺
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1">
                      <span className="font-semibold text-foreground">GBP:</span> 1 £ = {rates.gbp?.toFixed(2)} ₺
                    </span>
                  </div>
                )}
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground ml-auto">
                    Kurlar {relativeTimeFromNow(lastUpdated)} güncellendi.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Row 2: Bildirim Tercihleri */}
        <SectionCard
          icon={Bell}
          tint="amber"
          title="Bildirim Tercihleri"
          description="Hangi durumlarda bildirim almak istediğinizi seçin."
          hint="Değişiklikler anında uygulanır."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {NOTIFICATION_ROWS.map((row) => {
              const checked = notifications[row.id];
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                    checked ? PILL[row.tint] : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      checked ? TINTS[row.tint] : "bg-muted text-muted-foreground",
                    )}
                  >
                    <row.icon className="size-4" />
                  </div>
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div className="space-y-1 leading-none">
                      <Label htmlFor={row.id} className="cursor-pointer">
                        {row.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{row.description}</p>
                    </div>
                    <Checkbox
                      id={row.id}
                      checked={checked}
                      onCheckedChange={(c) => updateNotifications({ [row.id]: Boolean(c) })}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </Section>
      </SectionStack>
    </div>
  );
}

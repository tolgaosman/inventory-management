"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  User,
  Building,
  Bell,
  Shield,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
  ShoppingCart,
  UserCog,
  Wallet,
  Clock,
  Palette,
  Calendar,
  Coins,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useCurrency, type CurrencyCode } from "@/lib/currency-context";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useSettings } from "@/lib/settings-context";
import { ROLE_LABELS, TIMEZONE_OPTIONS } from "@/lib/constants";
import { RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { relativeTimeFromNow } from "@/lib/format";
import { TINTS, type TintName } from "@/lib/tints";
import type { Role } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const ROLE_ORDER: Role[] = ["yonetici", "satinalma", "depo"];

/**
 * Selected-state treatment for a choice pill or card. Every tint resolves to
 * the same brand treatment — a settings screen shouldn't use a different hue
 * per option. Kept keyed by `TintName` so call sites don't have to change.
 */
const SELECTED_PILL = "border-primary/30 bg-primary/10 text-primary";
const PILL: Record<TintName | "neutral", string> = {
  brand: SELECTED_PILL,
  neutral: SELECTED_PILL,
  positive: SELECTED_PILL,
  warning: SELECTED_PILL,
  critical: SELECTED_PILL,
  blue: SELECTED_PILL,
  indigo: SELECTED_PILL,
  violet: SELECTED_PILL,
  fuchsia: SELECTED_PILL,
  pink: SELECTED_PILL,
  red: SELECTED_PILL,
  orange: SELECTED_PILL,
  amber: SELECTED_PILL,
  yellow: SELECTED_PILL,
  green: SELECTED_PILL,
  teal: SELECTED_PILL,
  cyan: SELECTED_PILL,
  sky: SELECTED_PILL,
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
    <Card className="py-5 gap-3">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
          <div className={cn("flex size-9 items-center justify-center rounded-xl", TINTS[tint])}>
            <Icon className="size-4" />
          </div>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pt-2">{children}</CardContent>
      {(footer || hint) && (
        <CardFooter className="justify-between px-5">
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  tint: TintName | "neutral";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all cursor-pointer",
        selected ? cn(PILL[tint], "shadow-xs") : "border-border/60 bg-card hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          selected && tint !== "neutral" ? TINTS[tint] : selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <span className={cn("text-xs", selected ? "font-semibold" : "font-medium text-muted-foreground")}>{label}</span>
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
  const { name, initials, can, role, setRole } = useAuth();
  const {
    company,
    userProfile,
    notifications,
    timezone,
    showKurus,
    defaultRange,
    updateCompany,
    updateUserProfile,
    updateNotifications,
    setTimezone,
    setShowKurus,
    setDefaultRange,
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

      {/* HESABIM */}
      <section className="space-y-3">
        <CategoryHeader icon={User} tint="blue" title="Hesabım" description="Profil bilgileriniz ve parola güvenliği." />
        <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <SectionCard
            icon={User}
            tint="blue"
            title="Profil Bilgileri"
            description="Kişisel bilgilerinizi buradan güncelleyebilirsiniz."
            hint="Değişiklikler anında otomatik kaydedilir."
          >
            <div className="flex items-center gap-3">
              <Avatar size="lg" className="ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium",
                    PILL[ROLE_TINTS[role]],
                  )}
                >
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ad</Label>
                <Input
                  id="firstName"
                  value={userProfile.firstName}
                  onChange={(e) => updateUserProfile({ firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Soyad</Label>
                <Input
                  id="lastName"
                  value={userProfile.lastName}
                  onChange={(e) => updateUserProfile({ lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta Adresi</Label>
              <Input
                id="email"
                type="email"
                value={userProfile.email}
                onChange={(e) => updateUserProfile({ email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon Numarası</Label>
              <Input
                id="phone"
                type="tel"
                value={userProfile.phone}
                onChange={(e) => updateUserProfile({ phone: e.target.value })}
              />
            </div>
          </SectionCard>

          <form action={handleSecuritySave}>
            <SectionCard
              icon={Shield}
              tint="red"
              title="Güvenlik Ayarları"
              description="Parolanızı değiştirin ve güvenlik tercihlerinizi yönetin."
              footer={
                <SubmitButton type="submit" variant="destructive" pending={securityGuard.pending} pendingLabel="Güncelleniyor…">
                  Parolayı Güncelle
                </SubmitButton>
              }
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mevcut Parola</Label>
                <Input id="currentPassword" name="currentPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Yeni Parola</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {newPassword && (
                  <div className="flex items-center gap-2">
                    <Progress value={strength.score} className="flex-1">
                      <ProgressTrack>
                        <ProgressIndicator
                          className={cn(
                            strength.tone === "critical" && "bg-status-critical",
                            strength.tone === "warning" && "bg-status-warning",
                            strength.tone === "good" && "bg-status-good",
                          )}
                        />
                      </ProgressTrack>
                    </Progress>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        strength.tone === "critical" && "text-status-critical",
                        strength.tone === "warning" && "text-status-warning-foreground",
                        strength.tone === "good" && "text-status-good",
                      )}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Yeni Parola (Tekrar)</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" />
              </div>
            </SectionCard>
          </form>
        </div>
      </section>

      {/* TERCİHLER */}
      <section className="space-y-3">
        <CategoryHeader
          icon={Palette}
          tint="fuchsia"
          title="Tercihler"
          description="Görünüm, bildirim ve para birimi ayarları."
        />
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <SectionCard
            icon={Bell}
            tint="amber"
            title="Bildirim Tercihleri"
            description="Hangi durumlarda bildirim almak istediğinizi seçin."
            hint="Değişiklikler anında uygulanır."
          >
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
          </SectionCard>

          <SectionCard
            icon={Sun}
            tint="indigo"
            title="Görünüm"
            description="Arayüz temasını seçin."
            hint="Değişiklikler anında uygulanır."
          >
            {mounted ? (
              <div className="flex flex-wrap gap-2">
                <OptionCard icon={Sun} label="Açık" tint="amber" selected={theme === "light"} onClick={() => setTheme("light")} />
                <OptionCard icon={Moon} label="Koyu" tint="indigo" selected={theme === "dark"} onClick={() => setTheme("dark")} />
                <OptionCard
                  icon={Monitor}
                  label="Sistem"
                  tint="neutral"
                  selected={theme === "system"}
                  onClick={() => setTheme("system")}
                />
              </div>
            ) : (
              <Skeleton className="h-[74px] w-full" />
            )}
          </SectionCard>

          <SectionCard
            icon={Wallet}
            tint="green"
            title="Para Birimi"
            description="Fiyatlar, güncel kurlar üzerinden seçilen para birimine çevrilerek gösterilir."
            hint="Değişiklikler anında uygulanır."
          >
            <div className="flex items-center justify-between">
              <Label>Para Birimi</Label>
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
            <div className="flex flex-wrap gap-2">
              {CURRENCY_OPTIONS.map((c) => (
                <OptionCard
                  key={c.value}
                  icon={() => <span className="text-sm font-semibold">{c.symbol}</span>}
                  label={c.value.toUpperCase()}
                  tint={c.tint}
                  selected={currency === c.value}
                  onClick={() => setCurrency(c.value)}
                />
              ))}
            </div>
            {rates && currency !== "try" && (
              <p className="text-xs font-medium text-primary">
                Anlık Kur: 1 {currency.toUpperCase()} = {rates[currency]?.toFixed(4)} ₺
              </p>
            )}
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">Kurlar {relativeTimeFromNow(lastUpdated)} güncellendi.</p>
            )}
            <div className="flex items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Coins className="size-4" />
              </div>
              <div className="flex flex-1 items-start justify-between gap-3">
                <div className="space-y-1 leading-none">
                  <Label htmlFor="showKurus" className="cursor-pointer">
                    ₺ Kuruşları Göster
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Kapalıyken TL tutarlar tam sayıya yuvarlanır (ör. ₺1.235 yerine ₺1.234,56).
                  </p>
                </div>
                <Checkbox
                  id="showKurus"
                  checked={showKurus}
                  onCheckedChange={(c) => setShowKurus(Boolean(c))}
                  className="mt-0.5 shrink-0"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Clock}
            tint="sky"
            title="Saat Dilimi"
            description="Sistem saat ve tarih formatlamasında kullanılır."
            hint="Değişiklikler anında uygulanır."
          >
            <Select value={timezone} onValueChange={(v) => v && setTimezone(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {TIMEZONE_OPTIONS.find((t) => t.value === timezone)?.label ?? "Saat dilimi seçin"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SectionCard>

          <SectionCard
            icon={Calendar}
            tint="cyan"
            title="Panel Varsayılanı"
            description="Panel her açıldığında seçili gelecek tarih aralığı."
            hint="Değişiklikler anında uygulanır."
          >
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RANGE_LABELS) as DateRangePreset[]).map((r) => (
                <OptionCard
                  key={r}
                  icon={Calendar}
                  label={RANGE_LABELS[r]}
                  tint="cyan"
                  selected={defaultRange === r}
                  onClick={() => setDefaultRange(r)}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </section>

      {/* KURUMSAL & YETKİ */}
      <section className="space-y-3">
        <CategoryHeader
          icon={Building}
          tint="violet"
          title="Kurumsal & Yetki"
          description="Şirket bilgileri ve demo rol yönetimi."
        />
        <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <SectionCard
            icon={UserCog}
            tint="teal"
            title="Yetki Rolü (demo)"
            description="Tüm sitedeki yetkileri ve görünen menüleri anında değiştirir."
            hint="Değişiklikler anında uygulanır."
          >
            <div className="flex flex-wrap gap-2">
              {ROLE_ORDER.map((r) => (
                <OptionCard
                  key={r}
                  icon={User}
                  label={ROLE_LABELS[r]}
                  tint={ROLE_TINTS[r]}
                  selected={role === r}
                  onClick={() => {
                    setRole(r);
                    toast.info("Yetki Rolü Değiştirildi", {
                      description: `Aktif Rol: ${ROLE_LABELS[r]}`,
                    });
                  }}
                />
              ))}
            </div>
          </SectionCard>

          {can("users.manage") && (
            <SectionCard
              icon={Building}
              tint="violet"
              title="Şirket Bilgileri"
              description="Fatura ve resmi işlemler için kullanılacak şirket detayları."
              hint="Değişiklikler anında otomatik kaydedilir."
            >
              <div className="space-y-2">
                <Label htmlFor="companyName">Şirket Adı</Label>
                <Input
                  id="companyName"
                  value={company.companyName}
                  onChange={(e) => updateCompany({ companyName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                  <Input
                    id="taxOffice"
                    value={company.taxOffice}
                    onChange={(e) => updateCompany({ taxOffice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxNumber">Vergi Numarası</Label>
                  <Input
                    id="taxNumber"
                    value={company.taxNumber}
                    onChange={(e) => updateCompany({ taxNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Açık Adres</Label>
                <Input
                  id="address"
                  value={company.address}
                  onChange={(e) => updateCompany({ address: e.target.value })}
                />
              </div>
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}

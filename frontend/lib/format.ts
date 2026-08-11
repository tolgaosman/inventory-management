import { CURRENCY_SYMBOLS } from "./export/report-data";

// These formatters live at module scope (not inside a component/hook) so
// every call site — including plain functions like lib/export/report-data.ts
// — can format a value without needing React context. `configureFormatting`
// is the seam that lets SettingsProvider push preference changes (timezone,
// kuruş görünürlüğü) into them without threading props everywhere.
const config: { timeZone?: string; tryDecimals: boolean } = { timeZone: undefined, tryDecimals: false };

let trDate = buildDateFormatter({ day: "2-digit", month: "long" });
let trDateShort = buildDateFormatter({ day: "2-digit", month: "2-digit", year: "numeric" });
let trDateTime = buildDateFormatter({
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function buildDateFormatter(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("tr-TR", { ...opts, timeZone: config.timeZone });
}

/**
 * Reconfigures locale-dependent formatting app-wide. Called by
 * `SettingsProvider` once on hydration and again whenever the relevant
 * preference changes.
 */
export function configureFormatting(opts: { timeZone?: string; tryDecimals?: boolean }): void {
  if ("timeZone" in opts) config.timeZone = opts.timeZone;
  if (opts.tryDecimals !== undefined) config.tryDecimals = opts.tryDecimals;
  trDate = buildDateFormatter({ day: "2-digit", month: "long" });
  trDateShort = buildDateFormatter({ day: "2-digit", month: "2-digit", year: "numeric" });
  trDateTime = buildDateFormatter({
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const trNumber = new Intl.NumberFormat("tr-TR");

export function formatNumber(value: number): string {
  return trNumber.format(value);
}

export function formatCurrency(value: number, currencyCode: string = "TRY", rate: number = 1): string {
  const converted = value / (rate || 1);
  const code = currencyCode.toLowerCase();
  const decimals = code === "try" ? (config.tryDecimals ? 2 : 0) : 2;

  const formattedNumber = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted);

  const symbol = CURRENCY_SYMBOLS[code as keyof typeof CURRENCY_SYMBOLS] || currencyCode.toUpperCase();

  return `${formattedNumber} ${symbol}`;
}

export function formatDate(iso: string): string {
  return trDate.format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return trDateShort.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return trDateTime.format(new Date(iso));
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

export function relativeTimeFromNow(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} gün önce`;
  return formatDateShort(iso);
}

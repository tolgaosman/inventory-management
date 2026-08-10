const trNumber = new Intl.NumberFormat("tr-TR");
const trCurrencyUSD = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
});
const trDateShort = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const trDateTime = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatNumber(value: number): string {
  return trNumber.format(value);
}

export function formatCurrency(value: number): string {
  return trCurrencyUSD.format(value);
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

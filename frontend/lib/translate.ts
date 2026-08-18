/**
 * Google Translate (website widget) entegrasyonu.
 *
 * Widget, hedef dili `googtrans` çerezinden okur — bu yüzden dil değişimi
 * çerezi yazıp sayfayı yeniden yükleyerek uygulanır. Çerez, alt alan adları
 * için de geçerli olacak şekilde birkaç varyantla yazılır (widget'ın kendi
 * davranışı böyle).
 */

export const SOURCE_LANGUAGE = "tr";

export const LANGUAGE_OPTIONS = [
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
  { value: "en", label: "English", flag: "🇬🇧" },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];

const COOKIE_NAME = "googtrans";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGE_OPTIONS.some((l) => l.value === value);
}

export function readLanguageCookie(): LanguageCode {
  if (typeof document === "undefined") return SOURCE_LANGUAGE;
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return SOURCE_LANGUAGE;
  const target = decodeURIComponent(match[1]).split("/")[2];
  return isLanguageCode(target) ? target : SOURCE_LANGUAGE;
}

function writeCookie(value: string | null) {
  const domains = [undefined, window.location.hostname, `.${window.location.hostname}`];
  for (const domain of domains) {
    const domainPart = domain ? `; domain=${domain}` : "";
    if (value === null) {
      document.cookie = `${COOKIE_NAME}=; path=/${domainPart}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } else {
      document.cookie = `${COOKIE_NAME}=${value}; path=/${domainPart}`;
    }
  }
}

/** Hedef dili uygular. Widget'ın DOM'u baştan çevirmesi için sayfa yenilenir. */
export function applyLanguage(code: LanguageCode) {
  if (code === SOURCE_LANGUAGE) {
    writeCookie(null);
  } else {
    writeCookie(`/${SOURCE_LANGUAGE}/${code}`);
  }
  window.location.reload();
}

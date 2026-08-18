"use client";

import { useEffect } from "react";
import { SOURCE_LANGUAGE } from "@/lib/translate";

const SCRIPT_ID = "google-translate-script";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay?: boolean },
          containerId: string,
        ) => unknown;
      };
    };
  }
}

/**
 * Google'ın ücretsiz site çevirmeni widget'ını gizli olarak yükler. Widget,
 * hedef dili `googtrans` çerezinden okuyup sayfayı yükleme anında çevirir;
 * dil seçimi `lib/translate.ts` üzerinden yapılır.
 */
export function GoogleTranslate() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    window.googleTranslateElementInit = () => {
      new window.google!.translate.TranslateElement(
        { pageLanguage: SOURCE_LANGUAGE, autoDisplay: false },
        "google_translate_element",
      );
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div id="google_translate_element" aria-hidden className="hidden" />;
}

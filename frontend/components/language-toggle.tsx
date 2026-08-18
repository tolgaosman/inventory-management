"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGE_OPTIONS, applyLanguage, readLanguageCookie, type LanguageCode } from "@/lib/translate";

export function LanguageToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [currentLang, setCurrentLang] = React.useState<LanguageCode>("tr");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setCurrentLang(readLanguageCookie());
  }, []);

  if (!mounted) {
    return null;
  }

  const currentOption = LANGUAGE_OPTIONS.find((l) => l.value === currentLang) || LANGUAGE_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
          />
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/w40/${currentOption.value === "en" ? "gb" : currentOption.value}.png`}
          srcSet={`https://flagcdn.com/w80/${currentOption.value === "en" ? "gb" : currentOption.value}.png 2x`}
          alt={currentOption.value.toUpperCase()}
          className="w-[22px] h-[16px] object-cover rounded-sm shadow-[0_0_2px_rgba(0,0,0,0.15)]"
        />
        <span className="sr-only">Dil değiştir</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-[4rem]">
        {LANGUAGE_OPTIONS.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => applyLanguage(l.value)}
            className="flex items-center justify-center cursor-pointer p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://flagcdn.com/w40/${l.value === "en" ? "gb" : l.value}.png`}
              srcSet={`https://flagcdn.com/w80/${l.value === "en" ? "gb" : l.value}.png 2x`}
              alt={l.value.toUpperCase()}
              className="w-6 h-[17px] object-cover rounded-sm shadow-[0_0_2px_rgba(0,0,0,0.15)]"
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

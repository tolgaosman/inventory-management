"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import type { DateRangePreset } from "@/lib/api/dashboard";
import { TIMEZONE_OPTIONS } from "@/lib/constants";
import { configureFormatting } from "@/lib/format";

export interface CompanySettings {
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  address: string;
}

export interface UserProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface NotificationSettings {
  notifyStock: boolean;
  notifyOrder: boolean;
  notifySystem: boolean;
}

interface PersistedSettings {
  company: CompanySettings;
  userProfile: UserProfileSettings;
  notifications: NotificationSettings;
  timezone: string;
  role: Role;
  showKurus: boolean;
  defaultRange: DateRangePreset;
}

interface SettingsContextValue extends PersistedSettings {
  updateCompany: (newCompany: Partial<CompanySettings>) => void;
  updateUserProfile: (newProfile: Partial<UserProfileSettings>) => void;
  updateNotifications: (newNotifications: Partial<NotificationSettings>) => void;
  setTimezone: (newTz: string) => void;
  setRole: (role: Role) => void;
  setShowKurus: (value: boolean) => void;
  setDefaultRange: (range: DateRangePreset) => void;
}

const STORAGE_KEY = "net_app_settings_v2";

const DEFAULT_COMPANY: CompanySettings = {
  companyName: "Near East Technology",
  taxOffice: "Lefkoşa VD",
  taxNumber: "1234567890",
  address: "Yakın Doğu Bulvarı, Lefkoşa",
};

const DEFAULT_PROFILE: UserProfileSettings = {
  firstName: "Tolga Osman",
  lastName: "Falay",
  email: "tolgaosman@sirket.com",
  phone: "+90 555 123 4567",
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  notifyStock: true,
  notifyOrder: true,
  notifySystem: false,
};

const DEFAULTS: PersistedSettings = {
  company: DEFAULT_COMPANY,
  userProfile: DEFAULT_PROFILE,
  notifications: DEFAULT_NOTIFICATIONS,
  timezone: "europe-istanbul",
  role: "yonetici",
  showKurus: false,
  defaultRange: "son-6-ay",
};

function timezoneToIana(tz: string): string | undefined {
  return TIMEZONE_OPTIONS.find((t) => t.value === tz)?.iana;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanySettings>(DEFAULTS.company);
  const [userProfile, setUserProfile] = useState<UserProfileSettings>(DEFAULTS.userProfile);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULTS.notifications);
  const [timezone, setTimezoneState] = useState<string>(DEFAULTS.timezone);
  const [role, setRoleState] = useState<Role>(DEFAULTS.role);
  const [showKurus, setShowKurusState] = useState<boolean>(DEFAULTS.showKurus);
  const [defaultRange, setDefaultRangeState] = useState<DateRangePreset>(DEFAULTS.defaultRange);

  // Load from localStorage on mount, then push the formatting-relevant
  // preferences into lib/format.ts (which can't read this context directly).
  useEffect(() => {
    let loaded = DEFAULTS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        loaded = {
          company: { ...DEFAULTS.company, ...parsed.company },
          userProfile: { ...DEFAULTS.userProfile, ...parsed.userProfile },
          notifications: { ...DEFAULTS.notifications, ...parsed.notifications },
          timezone: parsed.timezone ?? DEFAULTS.timezone,
          role: parsed.role ?? DEFAULTS.role,
          showKurus: parsed.showKurus ?? DEFAULTS.showKurus,
          defaultRange: parsed.defaultRange ?? DEFAULTS.defaultRange,
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard, must run post-mount
        setCompany(loaded.company);
        setUserProfile(loaded.userProfile);
        setNotifications(loaded.notifications);
        setTimezoneState(loaded.timezone);
        setRoleState(loaded.role);
        setShowKurusState(loaded.showKurus);
        setDefaultRangeState(loaded.defaultRange);
      }
    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
    configureFormatting({ timeZone: timezoneToIana(loaded.timezone), tryDecimals: loaded.showKurus });
  }, []);

  const saveAll = (next: PersistedSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save settings to localStorage", e);
    }
  };

  const current = (): PersistedSettings => ({
    company,
    userProfile,
    notifications,
    timezone,
    role,
    showKurus,
    defaultRange,
  });

  const updateCompany = (newCompany: Partial<CompanySettings>) => {
    setCompany((prev) => {
      const next = { ...prev, ...newCompany };
      saveAll({ ...current(), company: next });
      return next;
    });
  };

  const updateUserProfile = (newProfile: Partial<UserProfileSettings>) => {
    setUserProfile((prev) => {
      const next = { ...prev, ...newProfile };
      saveAll({ ...current(), userProfile: next });
      return next;
    });
  };

  const updateNotifications = (newNotifications: Partial<NotificationSettings>) => {
    setNotifications((prev) => {
      const next = { ...prev, ...newNotifications };
      saveAll({ ...current(), notifications: next });
      return next;
    });
  };

  const setTimezone = (newTz: string) => {
    setTimezoneState(newTz);
    saveAll({ ...current(), timezone: newTz });
    configureFormatting({ timeZone: timezoneToIana(newTz) });
  };

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    saveAll({ ...current(), role: newRole });
  };

  const setShowKurus = (value: boolean) => {
    setShowKurusState(value);
    saveAll({ ...current(), showKurus: value });
    configureFormatting({ tryDecimals: value });
  };

  const setDefaultRange = (range: DateRangePreset) => {
    setDefaultRangeState(range);
    saveAll({ ...current(), defaultRange: range });
  };

  return (
    <SettingsContext.Provider
      value={{
        company,
        userProfile,
        notifications,
        timezone,
        role,
        showKurus,
        defaultRange,
        updateCompany,
        updateUserProfile,
        updateNotifications,
        setTimezone,
        setRole,
        setShowKurus,
        setDefaultRange,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

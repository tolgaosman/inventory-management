import { apiFetch } from "./client";

export interface ServerSettings {
  company: { companyName: string; taxOffice: string; taxNumber: string; address: string };
  notifications: { notifyStock: boolean; notifyOrder: boolean; notifySystem: boolean };
  timezone: string;
  showKurus: boolean;
  defaultRange: "bu-ay" | "son-3-ay" | "son-6-ay" | "bu-yil";
}

export async function getSettings(): Promise<ServerSettings> {
  return apiFetch<ServerSettings>("/settings");
}

/** Partial patch — only the keys you pass are written. */
export async function updateSettings(input: Partial<ServerSettings>): Promise<ServerSettings> {
  return apiFetch<ServerSettings>("/settings", { method: "PUT", body: input });
}

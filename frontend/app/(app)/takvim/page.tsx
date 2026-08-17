import { CalendarClient } from "@/components/calendar/calendar-client";

export const metadata = {
  title: "Takvim | Stok Yönetimi",
  description: "Tarihlere göre stok işlemleri ve sipariş takibi",
};

export default function CalendarPage() {
  return <CalendarClient />;
}

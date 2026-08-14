import { ReportsLoader } from "@/components/reports/reports-loader";

export const metadata = {
  title: "Raporlar | Stok Yönetim Sistemi",
  description: "Envanter, stok ve operasyon verilerinizi özelleştirilebilir raporlarla analiz edin ve dışa aktarın.",
};

export default function ReportsPage() {
  return <ReportsLoader />;
}

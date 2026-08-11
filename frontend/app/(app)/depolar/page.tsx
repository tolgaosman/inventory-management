import { WarehousesClient } from "@/components/warehouses/warehouses-client";

export const metadata = {
  title: "Depolar & Stok Matrisi | Stok Yönetim Sistemi",
  description: "Şirketinizin tüm lokasyonlardaki depolarını ve ürünlerin depo bazlı stok dağılımlarını canlı yönetin.",
};

export default function WarehousesPage() {
  return <WarehousesClient />;
}

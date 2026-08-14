import { CombinedMovementPage } from "@/components/stock/combined-movement-page";

export const metadata = {
  title: "Stok Girişi / Çıkışı | Stok Yönetim Sistemi",
  description: "Deponuza yeni giren ve çıkan stok hareketlerini tek ekrandan yönetin.",
};

export default function StockCombinedPage() {
  return <CombinedMovementPage />;
}

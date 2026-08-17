import { CombinedMovementPage } from "@/components/stock/combined-movement-page";

export const metadata = {
  title: "Giriş / Çıkış / Transfer | Stok Yönetim Sistemi",
  description: "Deponuza yeni giren, çıkan ve transfer edilen stok hareketlerini tek ekrandan yönetin.",
};

export default function StockCombinedPage() {
  return <CombinedMovementPage />;
}

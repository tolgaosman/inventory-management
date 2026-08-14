import { StockMovementPage } from "@/components/stock/stock-movement-page";

export const metadata = {
  title: "Stok Girişi | Stok Yönetim Sistemi",
  description: "Depoya yeni gelen ürünleri kaydedin, sistem stok miktarını otomatik artırır.",
};

export default function StockInPage() {
  return <StockMovementPage mode="giris" />;
}

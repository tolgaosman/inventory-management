import { StockMovementPage } from "@/components/stock/stock-movement-page";

export const metadata = {
  title: "Stok Çıkışı | Stok Yönetim Sistemi",
  description: "Satış, fire veya sayım düzeltmesiyle depodan çıkan ürünleri kaydedin.",
};

export default function StockOutPage() {
  return <StockMovementPage mode="cikis" />;
}

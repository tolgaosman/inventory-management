import { SuppliersClient } from "@/components/suppliers/suppliers-client";

export const metadata = {
  title: "Tedarikçi Yönetimi | Stok Yönetim Sistemi",
  description: "Ürünlerinizi tedarik ettiğiniz firmalar ve iletişim bilgileri.",
};

export default function SuppliersPage() {
  return <SuppliersClient />;
}

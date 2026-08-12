import { CategoriesClient } from "@/components/categories/categories-client";

export const metadata = {
  title: "Kategori Yönetimi | Stok Yönetim Sistemi",
  description: "Ürün kategorilerini üst/alt kategori olarak hiyerarşik biçimde yönetin.",
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}

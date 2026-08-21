import { RolesClient } from "@/components/users/roles-client";

export const metadata = {
  title: "Roller | Stok Yönetim Sistemi",
  description: "Sistemdeki rolleri görüntüleyin, yeni roller oluşturun ve izinlerini düzenleyin.",
};

export default function RolesPage() {
  return <RolesClient />;
}

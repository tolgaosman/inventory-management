import { UsersClient } from "@/components/users/users-client";

export const metadata = {
  title: "Kullanıcılar | Stok Yönetim Sistemi",
  description: "Sisteme kayıtlı kullanıcıları görüntüleyin, rolleri yönetin ve erişim izinlerini düzenleyin.",
};

export default function UsersPage() {
  return <UsersClient />;
}

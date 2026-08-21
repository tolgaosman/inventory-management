import { UserProfileClient } from "@/components/users/user-profile-client";

export const metadata = {
  title: "Personel Profili | Stok Yönetim Sistemi",
  description: "Personel detayları ve sistem aktiviteleri.",
};

export default async function UserProfilePage(props: PageProps<"/kullanicilar/[id]">) {
  const { id } = await props.params;
  return <UserProfileClient id={id} />;
}

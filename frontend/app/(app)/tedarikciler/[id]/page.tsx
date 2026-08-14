import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";

export default async function SupplierDetailPage(props: PageProps<"/tedarikciler/[id]">) {
  const { id } = await props.params;
  return <SupplierDetailClient id={id} />;
}

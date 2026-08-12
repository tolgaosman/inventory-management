import { WarehouseDetailClient } from "@/components/warehouses/warehouse-detail-client";

export default async function WarehouseDetailPage(props: PageProps<"/depolar/[id]">) {
  const { id } = await props.params;
  return <WarehouseDetailClient id={id} />;
}

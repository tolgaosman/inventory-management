import { PurchaseOrderDetailClient } from "@/components/purchase-orders/purchase-order-detail-client";

export default async function PurchaseOrderDetailPage(props: PageProps<"/satin-alma/[id]">) {
  const { id } = await props.params;
  return <PurchaseOrderDetailClient id={id} />;
}

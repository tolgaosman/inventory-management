import { ProductDetailClient } from "@/components/products/product-detail-client";

export default async function ProductDetailPage(props: PageProps<"/urunler/[id]">) {
  const { id } = await props.params;
  return <ProductDetailClient id={id} />;
}

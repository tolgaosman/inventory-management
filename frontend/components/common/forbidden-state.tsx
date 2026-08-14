import { ShieldAlert } from "lucide-react";
import { StatePanel } from "@/components/common/state-panel";

export function ForbiddenState({
  message = "Bu sayfayı görüntülemek için yetkiniz yok.",
}: {
  message?: string;
}) {
  return <StatePanel icon={ShieldAlert} tint="amber" title="Yetkisiz işlem" description={message} />;
}

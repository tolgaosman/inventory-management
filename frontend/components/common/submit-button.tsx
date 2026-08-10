import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export function SubmitButton({
  pending,
  children,
  pendingLabel = "Kaydediliyor…",
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { sharePurchaseOrder } from "@/lib/api/purchase-orders";
import { listUsers } from "@/lib/api/catalog";
import { useAsync } from "@/lib/hooks/use-async";
import { Loader2 } from "lucide-react";
import type { AppUser } from "@/lib/types";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";

interface ShareDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  initialSharedWith: string[];
  onDone: () => void;
}

export function ShareDraftDialog({ open, onOpenChange, orderId, initialSharedWith, onDone }: ShareDraftDialogProps) {
  const { pending, guard } = useSubmitGuard();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch users in the same department (or just all valid users, filtering by purchasing roles)
  const { data: allUsers, status } = useAsync(
    () => listUsers(),
    [],
  );
  
  const { user: currentUser } = useAuth();

  const purchUsers = allUsers?.filter(
    (u) => (u.role === "satinalma" || u.role === "satinalma_yonetici") && u.id !== currentUser?.id
  ) ?? [];

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(initialSharedWith));
    }
  }, [open, initialSharedWith]);

  const handleToggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleSave = async () => {
    await guard(async () => {
      await sharePurchaseOrder(orderId, Array.from(selectedIds));
      toast.success("Paylaşım ayarları güncellendi.");
      onDone();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Taslağı Paylaş</DialogTitle>
          <DialogDescription>
            Bu taslağı departmanınızdaki diğer personeller veya yöneticiler ile paylaşabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {status === "loading" && (
            <div className="flex justify-center p-4">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {status === "success" && purchUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">Paylaşılacak uygun kullanıcı bulunamadı.</p>
          )}
          {status === "success" && purchUsers.map((user: AppUser) => (
            <div key={user.id} className="flex items-start space-x-3">
              <Checkbox
                id={`user-${user.id}`}
                checked={selectedIds.has(user.id)}
                onCheckedChange={(checked) => handleToggle(user.id, !!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor={`user-${user.id}`}
                  className="font-medium cursor-pointer"
                >
                  {user.name}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {user.role === "satinalma_yonetici" ? "Satın Alma Müdürü" : "Satın Alma Personeli"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={pending || status !== "success"}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

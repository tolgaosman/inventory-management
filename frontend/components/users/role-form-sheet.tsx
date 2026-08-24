"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog as Sheet,
  DialogContent as SheetContent,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { createRole, updateRole, type RoleRow } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import type { Permission } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

/**
 * Every assignable permission, grouped for a readable checkbox grid. Keep in sync with
 * backend/config/permissions.php's flat list.
 *
 * A group may declare a `master` permission: the "view this page" switch (e.g.
 * dashboard.view, products.view). Turning it off disables and clears the group's items,
 * since those items are actions/sub-sections that only make sense once the page itself
 * is visible. Groups without a master (e.g. Stok İşlemleri, Raporlar) are pages whose
 * access is the OR of several independent, equally-weighted permissions — there is no
 * single "view" permission to promote, so all items stay independent checkboxes.
 */
const PERMISSION_GROUPS: {
  label: string;
  master?: { value: Permission; label: string };
  items: { value: Permission; label: string }[];
}[] = [
  {
    label: "Gösterge Paneli",
    master: { value: "dashboard.view", label: "Gösterge panelini görebilsin" },
    items: [
      { value: "dashboard.kpis", label: "Özet kartları" },
      { value: "dashboard.meta", label: "Ek özet çubuğu" },
      { value: "dashboard.purchase_summary", label: "Satın Alma Özeti" },
      { value: "dashboard.category_chart", label: "Stok Dağılımı" },
      { value: "dashboard.recent_movements", label: "Son Stok Hareketleri" },
      { value: "dashboard.stock_flow", label: "Stok Sağlığı" },
      { value: "dashboard.warehouse_stock", label: "Depo Bazında Stok" },
      { value: "dashboard.top_movers", label: "En Çok Hareket Gören Ürünler" },
      { value: "dashboard.critical_stock", label: "Stok İhtiyaçları" },
    ],
  },
  {
    label: "Ürünler",
    master: { value: "products.view", label: "Ürünler sayfasını görüntüleyebilsin" },
    items: [{ value: "products.manage", label: "Ürünleri yönet" }],
  },
  {
    label: "Depolar",
    master: { value: "warehouses.view", label: "Depolar sayfasını görüntüleyebilsin" },
    items: [{ value: "warehouses.manage", label: "Depoları yönet" }],
  },
  {
    label: "Stok Hareketleri",
    master: { value: "stock.view", label: "Hareket geçmişi sayfasını görüntüleyebilsin" },
    items: [],
  },
  {
    label: "Stok İşlemleri",
    items: [
      { value: "stock.in", label: "Stok girişi yap" },
      { value: "stock.out", label: "Stok çıkışı yap" },
      { value: "stock.transfer", label: "Depolar arası transfer yap" },
    ],
  },
  {
    label: "Satın Alma",
    master: { value: "purchase.view", label: "Satın Alma sayfasını görüntüleyebilsin" },
    items: [
      { value: "purchase.manage", label: "Sipariş oluştur / düzenle" },
      { value: "purchase.approve", label: "Siparişleri onayla" },
      { value: "purchase.receive", label: "Sipariş teslim al" },
    ],
  },
  {
    label: "Tedarikçiler",
    master: { value: "suppliers.view", label: "Tedarikçiler sayfasını görüntüleyebilsin" },
    items: [{ value: "suppliers.manage", label: "Tedarikçileri yönet" }],
  },
  {
    label: "Raporlar ve Finans",
    items: [
      { value: "reports.stock", label: "Stok raporlarını görüntüle" },
      { value: "reports.financial", label: "Finansal raporları görüntüle" },
      { value: "financial.view", label: "Fiyat / finansal bilgileri görüntüle" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { value: "users.manage", label: "Kullanıcıları yönet" },
      { value: "roles.manage", label: "Rolleri yönet" },
    ],
  },
];

interface RoleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow;
  onSaved: () => void;
}

export function RoleFormSheet({ open, onOpenChange, role, onSaved }: RoleFormSheetProps) {
  const { pending, guard } = useSubmitGuard();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<Permission>>(new Set());

  if (useChangedSince(open ? (role?.id ?? "new") : "closed")) {
    setName(role?.name ?? "");
    setSelected(new Set(role?.permissions ?? []));
  }

  function toggle(permission: Permission, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  /** Ticking the master grants the whole group; clearing it revokes the group too. */
  function toggleMaster(group: (typeof PERMISSION_GROUPS)[number], checked: boolean) {
    const master = group.master;
    if (!master) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(master.value);
        for (const item of group.items) next.add(item.value);
      } else {
        next.delete(master.value);
        for (const item of group.items) next.delete(item.value);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Rol adı gereklidir.");
      return;
    }
    if (selected.size === 0) {
      toast.error("En az bir izin seçmelisiniz.");
      return;
    }

    await guard(async () => {
      try {
        const input = { name: name.trim(), permissions: [...selected] };
        if (role) {
          await updateRole(role.id, input);
          toast.success("Rol güncellendi.", { description: input.name });
        } else {
          await createRole(input);
          toast.success("Rol oluşturuldu.", { description: input.name });
        }
        onOpenChange(false);
        onSaved();
      } catch (err) {
        toast.error(role ? "Rol güncellenemedi" : "Rol oluşturulamadı", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto max-h-[90vh] custom-scrollbar">
        <SheetHeader>
          <SheetTitle>{role ? "Rolü Düzenle" : "Yeni Rol"}</SheetTitle>
          <SheetDescription>
            {role
              ? "Rol adını ve izinlerini güncelleyin."
              : "Bir rol adı girin ve bu role hangi izinlerin verileceğini seçin."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Rol Adı</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Depo Sayım Sorumlusu"
              disabled={role?.isSystem}
            />
            {role?.isSystem && (
              <p className="text-xs text-muted-foreground">Sistem rollerinin adı değiştirilemez, sadece izinleri düzenlenebilir.</p>
            )}
          </div>

          <div className="space-y-4">
            <Label>İzinler</Label>
            {PERMISSION_GROUPS.map((group) => {
              const groupOff = group.master != null && !selected.has(group.master.value);
              return (
                <div key={group.label} className="space-y-2 rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
                  {group.master && (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <Checkbox
                          checked={selected.has(group.master.value)}
                          onCheckedChange={(c) => toggleMaster(group, Boolean(c))}
                        />
                        {group.master.label}
                      </label>
                      {group.items.length > 0 && <div className="border-t border-border/60 pt-2" />}
                    </>
                  )}
                  {group.items.length > 0 && (
                    <div
                      className={cn(
                        "grid grid-cols-1 gap-2 sm:grid-cols-2",
                        group.master && "pl-6",
                        groupOff && "opacity-50",
                      )}
                    >
                      {group.items.map((item) => (
                        <label
                          key={item.value}
                          className={cn(
                            "flex items-center gap-2 text-sm",
                            groupOff ? "cursor-not-allowed" : "cursor-pointer",
                          )}
                        >
                          <Checkbox
                            checked={selected.has(item.value)}
                            disabled={groupOff}
                            onCheckedChange={(c) => toggle(item.value, Boolean(c))}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <SubmitButton type="submit" pending={pending}>
              {role ? "Kaydet" : "Oluştur"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

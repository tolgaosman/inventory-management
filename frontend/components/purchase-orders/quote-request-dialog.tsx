"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker } from "@/components/products/product-picker";
import { getProduct } from "@/lib/api/products";
import type { Supplier } from "@/lib/types";
import type { QuoteItemInput } from "@/lib/api/quotes";

/** A quote line with enough display info to render, alongside the bare `QuoteItemInput` the API wants. */
type DraftItem = QuoteItemInput & { productName: string; unit: string };

export interface QuoteRequestSelection {
  supplierId?: string;
  adhocSupplierName?: string;
  adhocSupplierEmail?: string;
  items: QuoteItemInput[];
}

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  onContinue: (selection: QuoteRequestSelection) => void;
}

export function QuoteRequestDialog({ open, onOpenChange, suppliers, onContinue }: QuoteRequestDialogProps) {
  const [supplierId, setSupplierId] = useState("");
  const [useOtherSupplier, setUseOtherSupplier] = useState(false);
  const [adhocSupplierName, setAdhocSupplierName] = useState("");
  const [adhocSupplierEmail, setAdhocSupplierEmail] = useState("");

  const [items, setItems] = useState<DraftItem[]>([]);
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerQuantity, setPickerQuantity] = useState(1);
  const [addingCatalogItem, setAddingCatalogItem] = useState(false);

  const [adhocItemOpen, setAdhocItemOpen] = useState(false);
  const [adhocName, setAdhocName] = useState("");
  const [adhocUnit, setAdhocUnit] = useState("Adet");
  const [adhocQuantity, setAdhocQuantity] = useState(1);

  function reset() {
    setSupplierId("");
    setUseOtherSupplier(false);
    setAdhocSupplierName("");
    setAdhocSupplierEmail("");
    setItems([]);
    setPickerProductId("");
    setPickerQuantity(1);
    setAdhocItemOpen(false);
    setAdhocName("");
    setAdhocUnit("Adet");
    setAdhocQuantity(1);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleAddCatalogItem() {
    if (!pickerProductId || pickerQuantity < 1) return;
    setAddingCatalogItem(true);
    try {
      const product = await getProduct(pickerProductId);
      setItems((prev) => [
        ...prev,
        { productId: product.id, productName: product.name, unit: product.unit, quantity: pickerQuantity },
      ]);
      setPickerProductId("");
      setPickerQuantity(1);
    } finally {
      setAddingCatalogItem(false);
    }
  }

  function handleAddAdhocItem() {
    if (adhocName.trim() === "" || adhocUnit.trim() === "" || adhocQuantity < 1) return;
    setItems((prev) => [
      ...prev,
      { productName: adhocName.trim(), unit: adhocUnit.trim(), quantity: adhocQuantity },
    ]);
    setAdhocName("");
    setAdhocUnit("Adet");
    setAdhocQuantity(1);
    setAdhocItemOpen(false);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const adhocEmailValid = adhocSupplierEmail.trim().includes("@");
  const supplierValid = useOtherSupplier
    ? adhocSupplierName.trim() !== "" && adhocEmailValid
    : supplierId !== "";
  const canContinue = supplierValid && items.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    onContinue({
      supplierId: useOtherSupplier ? undefined : supplierId,
      adhocSupplierName: useOtherSupplier ? adhocSupplierName.trim() : undefined,
      adhocSupplierEmail: useOtherSupplier ? adhocSupplierEmail.trim() : undefined,
      items: items.map(({ productId, productName, unit, quantity }) => ({ productId, productName, unit, quantity })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Teklif Formu Oluştur</DialogTitle>
          <DialogDescription>
            Bir tedarikçi ve teklif istenecek kalemleri seçin. Henüz bir sipariş oluşturmanız gerekmez.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5 px-4 pb-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Tedarikçi</Label>
            {!useOtherSupplier && (
              <Select
                value={supplierId}
                onValueChange={(v) => {
                  setSupplierId(v ?? "");
                  setPickerProductId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {supplierId ? suppliers.find((s) => s.id === supplierId)?.name : "Tedarikçi seçin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-start space-x-3 pt-1">
              <Checkbox
                id="use-other-supplier"
                checked={useOtherSupplier}
                onCheckedChange={(checked) => {
                  setUseOtherSupplier(!!checked);
                  setSupplierId("");
                  setPickerProductId("");
                }}
                className="mt-0.5"
              />
              <Label htmlFor="use-other-supplier" className="font-normal cursor-pointer text-sm">
                Başka bir tedarikçi seçmek istiyorum
              </Label>
            </div>

            {useOtherSupplier && (
              <div className="space-y-2">
                <Input
                  placeholder="Tedarikçi adı"
                  value={adhocSupplierName}
                  onChange={(e) => setAdhocSupplierName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Tedarikçi e-postası"
                  value={adhocSupplierEmail}
                  onChange={(e) => setAdhocSupplierEmail(e.target.value)}
                  aria-invalid={adhocSupplierEmail.trim() !== "" && !adhocEmailValid}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Kalemler</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <ProductPicker
                  value={pickerProductId}
                  onChange={setPickerProductId}
                  supplierId={!useOtherSupplier ? supplierId || undefined : undefined}
                />
              </div>
              <Input
                type="number"
                min={1}
                className="w-20 shrink-0"
                value={pickerQuantity}
                onChange={(e) => setPickerQuantity(Number(e.target.value) || 1)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!pickerProductId || addingCatalogItem}
                onClick={handleAddCatalogItem}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="flex items-start space-x-3 pt-1">
              <Checkbox
                id="add-adhoc-item"
                checked={adhocItemOpen}
                onCheckedChange={(checked) => setAdhocItemOpen(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor="add-adhoc-item" className="font-normal cursor-pointer text-sm">
                Yeni ürün girmek istiyorum
              </Label>
            </div>

            {adhocItemOpen && (
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Input
                  placeholder="Ürün adı"
                  value={adhocName}
                  onChange={(e) => setAdhocName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Select value={adhocUnit} onValueChange={(v) => setAdhocUnit(v ?? "")}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Birim seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adet">Adet</SelectItem>
                      <SelectItem value="Lisans">Lisans</SelectItem>
                      <SelectItem value="Kg">Kg</SelectItem>
                      <SelectItem value="Litre">Litre</SelectItem>
                      <SelectItem value="Metre">Metre</SelectItem>
                      <SelectItem value="Kutu">Kutu</SelectItem>
                      <SelectItem value="Paket">Paket</SelectItem>
                      <SelectItem value="Ay">Ay</SelectItem>
                      <SelectItem value="Yıl">Yıl</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-24 shrink-0"
                    value={adhocQuantity}
                    onChange={(e) => setAdhocQuantity(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={adhocName.trim() === "" || adhocUnit.trim() === ""}
                    onClick={handleAddAdhocItem}
                  >
                    <Plus className="size-4" />
                    Kalemi Ekle
                  </Button>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate font-medium">{item.productName}</span>
                      {!item.productId && (
                        <span className="ml-2 rounded px-1.5 py-0.5 text-[0.65rem] font-medium bg-tint-amber/12 text-tint-amber">
                          Yeni ürün
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.quantity} {item.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleContinue} disabled={!canContinue}>
            Devam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

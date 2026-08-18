"use client";

import { useEffect, useRef } from "react";
import { useForm, useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SteppedFormDialog } from "@/components/common/stepped-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { ProductPicker } from "@/components/products/product-picker";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCY_SYMBOLS } from "@/lib/export/report-data";
import { getProduct } from "@/lib/api/products";
import { formatCurrency } from "@/lib/format";
import type { PurchaseOrder, Supplier } from "@/lib/types";

const itemSchema = z.object({
  productId: z.string().min(1, "Ürün seçin."),
  quantity: z.coerce.number().int().positive("Miktar 0'dan büyük olmalı."),
  unitPrice: z.coerce.number().nonnegative("Birim fiyat negatif olamaz."),
});

const PRIORITIES = ["low", "medium", "high"] as const;

const schema = z
  .object({
    supplierId: z.string().min(1, "Tedarikçi seçin."),
    warehouseId: z.string().min(1, "Teslim deposu seçin."),
    expectedAt: z.string().min(1, "Beklenen teslim tarihi gerekli."),
    priority: z.enum(PRIORITIES),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "En az bir kalem ekleyin."),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.items.forEach((item, index) => {
      if (!item.productId) return;
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bu ürün zaten eklendi.",
          path: ["items", index, "productId"],
        });
      }
      seen.add(item.productId);
    });
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface WarehouseOption {
  id: string;
  name: string;
}

/** ISO datetime → the `yyyy-MM-dd` shape a native date input expects. */
function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

const EMPTY_ITEM = { productId: "", quantity: 1, unitPrice: 0 };

interface PurchaseOrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence ⇒ edit mode. */
  order?: PurchaseOrder;
  /** Pre-filled items for the "start a request from a critical-stock product" deep link (create mode only). */
  initialItems?: { productId: string; quantity: number; unitPrice: number }[];
  suppliers: Supplier[];
  warehouses: WarehouseOption[];
  onSaved: (values: FormValues) => Promise<void>;
}

export function PurchaseOrderFormSheet({
  open,
  onOpenChange,
  order,
  initialItems,
  suppliers,
  warehouses,
  onSaved,
}: PurchaseOrderFormSheetProps) {
  const { pending, guard } = useSubmitGuard();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierId: "",
      warehouseId: "",
      expectedAt: "",
      priority: "medium",
      notes: "",
      items: [EMPTY_ITEM],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  useEffect(() => {
    if (!open) return;
    if (order) {
      form.reset({
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        expectedAt: toDateInputValue(order.expectedAt),
        priority: order.priority || "medium",
        notes: order.notes ?? "",
        items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
    } else {
      form.reset({
        supplierId: "",
        warehouseId: "",
        expectedAt: "",
        priority: "medium",
        notes: "",
        items: initialItems && initialItems.length > 0 ? initialItems : [EMPTY_ITEM],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order, initialItems]);

  const watchedItems = useWatch({ control: form.control, name: "items" }) ?? [];
  const total = watchedItems.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      await onSaved({ ...values, expectedAt: new Date(values.expectedAt).toISOString() });
      toast.success(order ? "Sipariş güncellendi." : "Yeni sipariş oluşturuldu.");
      onOpenChange(false);
    });
  }

  return (
    <Form {...form}>
      <SteppedFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={order ? "Siparişi Düzenle" : "Yeni Satın Alma Siparişi"}
        description={order ? "Sipariş bilgilerini güncelleyin." : "Bir tedarikçiye birden çok kalem içeren bir sipariş oluşturun."}
        submitLabel={order ? "Değişiklikleri Kaydet" : "Siparişi Oluştur"}
        isSubmitting={pending}
        onSubmit={form.handleSubmit(onSubmit)}
        steps={[
          {
            id: "basics",
            label: "Temel Bilgiler",
            onValidate: () => form.trigger(["supplierId", "warehouseId", "expectedAt", "priority"]),
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tedarikçi</FormLabel>
                        <Select value={field.value as string} onValueChange={(v) => field.onChange(v ?? "")}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {field.value ? suppliers.find((s) => s.id === field.value)?.name : "Tedarikçi seçin"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="warehouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teslim Deposu</FormLabel>
                        <Select value={field.value as string} onValueChange={(v) => field.onChange(v ?? "")}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {field.value ? warehouses.find((w) => w.id === field.value)?.name : "Depo seçin"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {warehouses.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expectedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beklenen Teslim Tarihi</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Öncelik</FormLabel>
                        <Select value={field.value as string} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {field.value === "low" ? "Düşük" : field.value === "medium" ? "Orta" : field.value === "high" ? "Yüksek" : "Öncelik seçin"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Düşük</SelectItem>
                            <SelectItem value="medium">Orta</SelectItem>
                            <SelectItem value="high">Yüksek</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ),
          },
          {
            id: "items",
            label: "Sipariş Kalemleri",
            onValidate: () => form.trigger(["items"]),
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Kalem Listesi</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ ...EMPTY_ITEM })}
                  >
                    <Plus className="size-4 mr-2" />
                    Kalem Ekle
                  </Button>
                </div>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <PurchaseOrderItemRow
                      key={field.id}
                      control={form.control}
                      setValue={form.setValue}
                      index={index}
                      currency={currency}
                      rate={rate}
                      onRemove={() => remove(index)}
                      removeDisabled={fields.length === 1}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 mt-4">
                  <span className="text-sm font-medium text-muted-foreground">Genel Toplam</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {formatCurrency(total / rate, currency, 1, true)}
                  </span>
                </div>
              </div>
            ),
          },
          {
            id: "review",
            label: "Notlar & Onay",
            content: (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notlar (Opsiyonel)</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={4} 
                          placeholder="Siparişe özel eklemek istediğiniz notlar..." 
                          {...field} 
                          value={field.value ?? ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Summary Box */}
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 mt-6 space-y-3 text-sm">
                  <h4 className="font-semibold text-foreground mb-1">Sipariş Özeti</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Toplam Kalem:</span>
                    <span className="font-medium">{fields.length} çeşit ürün</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sipariş Tutarı:</span>
                    <span className="font-medium text-primary">
                      {formatCurrency(total / rate, currency, 1, true)}
                    </span>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Form>
  );
}

function PurchaseOrderItemRow({
  control,
  setValue,
  index,
  currency,
  rate,
  onRemove,
  removeDisabled,
}: {
  control: Control<FormInput>;
  setValue: UseFormSetValue<FormInput>;
  index: number;
  currency: string;
  rate: number;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  const productId = useWatch({ control, name: `items.${index}.productId` });
  const quantity = useWatch({ control, name: `items.${index}.quantity` });
  const unitPrice = useWatch({ control, name: `items.${index}.unitPrice` });

  const { data: product } = useAsync(
    () => (productId ? getProduct(productId as string) : Promise.resolve(undefined)),
    [productId],
  );

  // Auto-fill the unit price once per product selection, from the product's
  // own purchase price. Prices are stored (and edited here) in TRY, same as
  // `Product.purchasePrice` — `rate` is only used below to preview the total
  // in the user's selected display currency, never to convert the stored value.
  const autoFilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (product && autoFilledFor.current !== product.id) {
      autoFilledFor.current = product.id;
      setValue(`items.${index}.unitPrice`, product.purchasePrice, { shouldValidate: true });
    }
  }, [product, index, setValue]);

  const subtotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <FormField
            control={control}
            name={`items.${index}.productId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ürün</FormLabel>
                <FormControl>
                  <ProductPicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={removeDisabled}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Miktar</FormLabel>
              <FormControl>
                <Input type="number" min={1} {...field} value={field.value as number | string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.unitPrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Birim Fiyat ({CURRENCY_SYMBOLS.try})</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min={0} {...field} value={field.value as number | string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <p className="text-right text-xs text-muted-foreground">
        Ara toplam: <span className="font-medium text-foreground">{formatCurrency(subtotal / rate, currency, 1, true)}</span>
      </p>
    </div>
  );
}

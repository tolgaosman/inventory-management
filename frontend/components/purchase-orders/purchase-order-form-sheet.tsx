"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SteppedFormDialog } from "@/components/common/stepped-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  isAdhoc: z.boolean().default(false),
  productId: z.string().optional(),
  productName: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int().positive("Miktar 0'dan büyük olmalı."),
  unitPrice: z.coerce.number().nonnegative("Birim fiyat negatif olamaz."),
}).superRefine((val, ctx) => {
  if (val.isAdhoc) {
    if (!val.productName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ürün adı gerekli.", path: ["productName"] });
    }
    if (!val.unit?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Birim gerekli.", path: ["unit"] });
    }
  } else if (!val.productId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ürün seçin.", path: ["productId"] });
  }
});

const PRIORITIES = ["low", "medium", "high"] as const;

const schema = z
  .object({
    useOtherSupplier: z.boolean().default(false),
    supplierId: z.string().optional(),
    adhocSupplierName: z.string().optional(),
    adhocSupplierEmail: z.string().email("Geçerli bir e-posta girin.").optional().or(z.literal("")),
    warehouseId: z.string().optional(),
    expectedAt: z.string().min(1, "Beklenen teslim tarihi gerekli."),
    priority: z.enum(PRIORITIES),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "En az bir kalem ekleyin."),
  })
  .superRefine((values, ctx) => {
    if (values.useOtherSupplier) {
      if (!values.adhocSupplierName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tedarikçi adı gerekli.", path: ["adhocSupplierName"] });
      }
      if (!values.adhocSupplierEmail?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "E-posta gerekli.", path: ["adhocSupplierEmail"] });
      }
    } else if (!values.supplierId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tedarikçi seçin.", path: ["supplierId"] });
    }

    const seen = new Set<string>();
    values.items.forEach((item, index) => {
      if (!item.isAdhoc && item.productId) {
        if (seen.has(item.productId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Bu ürün zaten eklendi.",
            path: ["items", index, "productId"],
          });
        }
        seen.add(item.productId);
      }
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

const EMPTY_ITEM = { isAdhoc: false, productId: "", productName: "", unit: "Adet", quantity: 1, unitPrice: 0 };

interface PurchaseOrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence ⇒ edit mode. */
  order?: PurchaseOrder;
  /** Pre-filled items for the "start a request from a critical-stock product" deep link (create mode only). */
  initialItems?: { productId: string; quantity: number; unitPrice: number }[];
  suppliers: Supplier[];
  onSaved: (values: FormValues & { isDraft?: boolean }) => Promise<void>;
}

export function PurchaseOrderFormSheet({
  open,
  onOpenChange,
  order,
  initialItems,
  suppliers,
  onSaved,
}: PurchaseOrderFormSheetProps) {
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const { pending, guard } = useSubmitGuard();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      useOtherSupplier: false,
      supplierId: "",
      adhocSupplierName: "",
      adhocSupplierEmail: "",
      expectedAt: "",
      priority: "medium",
      notes: "",
      items: [EMPTY_ITEM],
    },
  });

  // Keep useOtherSupplier in sync with form data changes manually if needed
  const useOtherSupplier = form.watch("useOtherSupplier");

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  useEffect(() => {
    if (!open) return;
    if (order) {
      const isAdhoc = !order.supplierId;
      form.reset({
        useOtherSupplier: isAdhoc,
        supplierId: order.supplierId || "",
        adhocSupplierName: order.adhocSupplierName || "",
        adhocSupplierEmail: order.adhocSupplierEmail || "",
        expectedAt: toDateInputValue(order.expectedAt),
        priority: order.priority || "medium",
        notes: order.notes ?? "",
        items: order.items.map((i) => ({ 
          isAdhoc: !i.productId,
          productId: i.productId || "", 
          productName: i.productName || "",
          unit: i.unit || "Adet",
          quantity: i.quantity, 
          unitPrice: i.unitPrice 
        })),
      });
    } else {
      form.reset({
        useOtherSupplier: false,
        supplierId: "",
        adhocSupplierName: "",
        adhocSupplierEmail: "",
        expectedAt: "",
        priority: "medium",
        notes: "",
        items: initialItems && initialItems.length > 0 ? initialItems.map(i => ({...i, isAdhoc: false})) : [EMPTY_ITEM],
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

  const today = new Date().toISOString().split("T")[0];

  async function onSubmit(values: FormValues, isDraft = false) {
    await guard(async () => {
      await onSaved({ ...values, expectedAt: new Date(values.expectedAt || new Date()).toISOString(), isDraft });
      toast.success(order ? "Sipariş güncellendi." : (isDraft ? "Taslak olarak kaydedildi." : "Yeni sipariş oluşturuldu."));
      onOpenChange(false);
    });
  }

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      onOpenChange(true);
    } else {
      // Only prompt for draft if it's a new order or already a draft
      if (!order || order.status === "draft") {
        setDraftPromptOpen(true);
      } else {
        onOpenChange(false);
      }
    }
  }

  async function handleSaveDraft() {
    const isValid = await form.trigger(["useOtherSupplier", "supplierId", "adhocSupplierName", "adhocSupplierEmail", "expectedAt", "priority"]);
    if (!isValid) {
      toast.error("Taslak kaydetmek için lütfen zorunlu alanları (Tedarikçi vb.) doldurun.");
      return;
    }
    setDraftPromptOpen(false);
    const values = form.getValues();
    const validItems = values.items?.filter((i) => (i.isAdhoc && i.productName) || (!i.isAdhoc && i.productId)) || [];
    onSubmit({ ...values, items: validItems } as unknown as FormValues, true);
  }

  return (
    <>
      <Form {...form}>
        <SteppedFormDialog
          open={open}
          onOpenChange={handleOpenChange}
          onCancel={() => handleOpenChange(false)}
          showCloseButton={true}
          title={order ? "Siparişi Düzenle" : "Yeni Satın Alma Siparişi"}
        description={order ? "Sipariş bilgilerini güncelleyin." : "Bir tedarikçiye birden çok kalem içeren bir sipariş oluşturun."}
        submitLabel={order ? "Değişiklikleri Kaydet" : "Siparişi Oluştur"}
        isSubmitting={pending}
        onSubmit={form.handleSubmit((v) => onSubmit(v, false))}
        steps={[
          {
            id: "basics",
            label: "Temel Bilgiler",
            onValidate: () => form.trigger(["useOtherSupplier", "supplierId", "adhocSupplierName", "adhocSupplierEmail", "expectedAt", "priority"]),
            content: (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tedarikçi</Label>
                  {!useOtherSupplier && (
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value as string} onValueChange={(v) => field.onChange(v ?? "")}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Sistemde kayıtlı tedarikçi seçin">
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
                  )}

                  <div className="flex items-start space-x-3 pt-1 mb-2">
                    <FormField
                      control={form.control}
                      name="useOtherSupplier"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) {
                                  form.setValue("supplierId", "");
                                } else {
                                  form.setValue("adhocSupplierName", "");
                                  form.setValue("adhocSupplierEmail", "");
                                }
                              }} 
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer text-sm m-0">Sistemde Kayıtlı Olmayan Tedarikçi</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {useOtherSupplier && (
                    <div className="space-y-3 pt-2">
                      <FormField
                        control={form.control}
                        name="adhocSupplierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Tedarikçi adı" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="adhocSupplierEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="email" placeholder="E-posta (Opsiyonel, gönderim için)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expectedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beklenen Teslim Tarihi</FormLabel>
                        <FormControl>
                          <Input type="date" min={today} {...field} />
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
      <AlertDialog open={draftPromptOpen} onOpenChange={setDraftPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydetmeden Çık</AlertDialogTitle>
            <AlertDialogDescription>
              Bu siparişi taslak olarak kaydetmek ister misiniz? 
              İptal ederseniz değişiklikleriniz silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDraftPromptOpen(false); onOpenChange(false); }}>
              İptal Et (Kaydetme)
            </AlertDialogCancel>
            <Button onClick={handleSaveDraft}>
              Taslak Olarak Kaydet
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const isAdhoc = useWatch({ control, name: `items.${index}.isAdhoc` });
  const productId = useWatch({ control, name: `items.${index}.productId` });
  const quantity = useWatch({ control, name: `items.${index}.quantity` });
  const unitPrice = useWatch({ control, name: `items.${index}.unitPrice` });

  const { data: product } = useAsync(
    () => (!isAdhoc && productId ? getProduct(productId as string) : Promise.resolve(undefined)),
    [productId, isAdhoc],
  );

  // Auto-fill the unit price once per product selection, from the product's
  // own purchase price. Prices are stored (and edited here) in TRY, same as
  // `Product.purchasePrice` — `rate` is only used below to preview the total
  // in the user's selected display currency, never to convert the stored value.
  const autoFilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isAdhoc && product && autoFilledFor.current !== product.id) {
      autoFilledFor.current = product.id;
      setValue(`items.${index}.unitPrice`, product.purchasePrice ?? 0, { shouldValidate: true });
    }
  }, [product, index, setValue, isAdhoc]);

  const subtotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          {!isAdhoc ? (
            <FormField
              control={control}
              name={`items.${index}.productId`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ProductPicker value={field.value || ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="grid grid-cols-[1fr,100px] gap-2">
              <FormField
                control={control}
                name={`items.${index}.productName`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Ürün adı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`items.${index}.unit`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Birim" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <FormField
            control={control}
            name={`items.${index}.isAdhoc`}
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked) {
                        setValue(`items.${index}.productId`, "", { shouldValidate: false });
                        setValue(`items.${index}.unitPrice`, 0, { shouldValidate: false });
                        autoFilledFor.current = null;
                      } else {
                        setValue(`items.${index}.productName`, "", { shouldValidate: false });
                        setValue(`items.${index}.unit`, "Adet", { shouldValidate: false });
                      }
                    }} 
                  />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer text-xs text-muted-foreground m-0">Katalog dışı serbest ürün ekle</FormLabel>
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
                <Input 
                  type="number" 
                  step="0.01" 
                  min={0} 
                  {...field} 
                  value={field.value as number | string} 
                  readOnly={!isAdhoc}
                  className={!isAdhoc ? "bg-muted/50 cursor-not-allowed" : ""}
                  title={!isAdhoc ? "Birim fiyat ürün kataloğundan alınır, sadece Ürün Yönetimi sayfasından değiştirilebilir." : "Birim fiyatı girin"}
                />
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

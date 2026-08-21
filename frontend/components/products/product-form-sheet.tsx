"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCY_SYMBOLS } from "@/lib/export/report-data";
import type { Product, Category, Supplier } from "@/lib/types";

import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { Upload, X as ClearIcon } from "lucide-react";

const schema = z
  .object({
    name: z.string().min(2, "Ürün adı en az 2 karakter olmalı."),
    sku: z.string().min(2, "SKU zorunlu."),
    barcode: z.string().min(4, "Barkod en az 4 haneli olmalı."),
    categoryId: z.string().min(1, "Kategori seçin."),
    brand: z.string().min(1, "Marka zorunlu."),
    unit: z.string().min(1, "Birim zorunlu."),
    purchasePrice: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.coerce.number().min(0, "Alış fiyatı negatif olamaz.").optional(),
    ),
    salePrice: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z.coerce.number().min(0, "Satış fiyatı negatif olamaz.").optional(),
    ),
    minStock: z.coerce.number().int().min(0, "Minimum stok negatif olamaz."),
    maxStock: z.coerce.number().int().min(1, "Maksimum stok en az 1 olmalı."),
    supplierId: z.string().min(1, "Tedarikçi seçin."),
    imageUrl: z.string().optional(),
  })
  .refine((v) => v.maxStock >= v.minStock, {
    message: "Maksimum stok, minimum stoktan küçük olamaz.",
    path: ["maxStock"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
/** What actually gets submitted — `purchasePrice`/`salePrice` resolved to `number | null` (never left `undefined`) and rate-converted back to the base currency. */
type ProductSubmission = Omit<FormValues, "purchasePrice" | "salePrice"> & { purchasePrice: number | null; salePrice: number | null };

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSaved: (values: ProductSubmission) => Promise<void>;
  categories: Category[];
  suppliers: Supplier[];
  /** Sale price only belongs on the product detail page's edit flow — the Ürün Yönetimi list/form never shows it. */
  showSalePrice?: boolean;
}

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSaved,
  categories,
  suppliers,
  showSalePrice = false,
}: ProductFormSheetProps) {
  const { pending, guard } = useSubmitGuard();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      categoryId: "",
      brand: "",
      unit: "Adet",
      purchasePrice: undefined,
      salePrice: undefined,
      minStock: 5,
      maxStock: 50,
      supplierId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              categoryId: product.categoryId,
              brand: product.brand,
              unit: product.unit,
              purchasePrice: product.purchasePrice != null ? product.purchasePrice / rate : undefined,
              salePrice: product.salePrice != null ? product.salePrice / rate : undefined,
              minStock: product.minStock,
              maxStock: product.maxStock,
              supplierId: product.supplierId,
              imageUrl: product.imageUrl || "",
            }
          : {
              name: "",
              sku: "",
              barcode: "",
              categoryId: "",
              brand: "",
              unit: "Adet",
              purchasePrice: undefined,
              salePrice: undefined,
              minStock: 5,
              maxStock: 50,
              supplierId: "",
              imageUrl: "",
            },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, rate]);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      const submission = {
        ...values,
        purchasePrice: values.purchasePrice != null ? values.purchasePrice * rate : null,
        salePrice: values.salePrice != null ? values.salePrice * rate : null,
      };
      await onSaved(submission);
      toast.success(product ? "Ürün güncellendi." : "Ürün oluşturuldu.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{product ? "Ürünü Düzenle" : "Yeni Ürün"}</SheetTitle>
          <SheetDescription>
            {product ? "Ürün bilgilerini güncelleyin." : "Katalogda yeni bir ürün oluşturun."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ürün Görseli</FormLabel>
                  <div className="flex items-center gap-3">
                    <ProductImageThumbnail src={field.value} alt="Önizleme" size="lg" />
                    <div className="flex-1 space-y-1.5">
                      <FormControl>
                        <Input
                          placeholder="Görsel URL'si (https://...)"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1 text-micro font-medium text-primary hover:underline">
                          <Upload className="size-3" />
                          Dosya Yükle
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  if (evt.target?.result) {
                                    field.onChange(evt.target.result as string);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {field.value && (
                          <button
                            type="button"
                            onClick={() => field.onChange("")}
                            className="inline-flex items-center gap-0.5 text-micro font-medium text-destructive hover:underline"
                          >
                            <ClearIcon className="size-3" />
                            Kaldır
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ürün Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="MacBook Pro 14" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="MBP14-2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barkod</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select value={field.value as string} onValueChange={(v) => field.onChange(v ?? "")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {field.value ? categories.find((c) => c.id === field.value)?.name : "Kategori seçin"}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories
                        .filter((c) => c.parentId !== null)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marka</FormLabel>
                    <FormControl>
                      <Input placeholder="Apple" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <FormControl>
                      <Input placeholder="Adet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Son Satın Alış Fiyatı ({CURRENCY_SYMBOLS[currency]}) (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Boş bırakılabilir"
                      {...field}
                      value={(field.value as number | undefined) ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showSalePrice && (
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Satış Fiyatı ({CURRENCY_SYMBOLS[currency]}) (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Boş bırakılabilir"
                        {...field}
                        value={(field.value as number | undefined) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="minStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Stok</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maksimum Stok</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <SheetFooter className="flex-row justify-end gap-2 px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <SubmitButton type="submit" pending={pending}>
                {product ? "Kaydet" : "Ürünü Oluştur"}
              </SubmitButton>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

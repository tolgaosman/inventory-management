"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { categories, suppliers } from "@/lib/mock/data";
import type { Product } from "@/lib/types";

const schema = z
  .object({
    name: z.string().min(2, "Ürün adı en az 2 karakter olmalı."),
    sku: z.string().min(2, "SKU zorunlu."),
    barcode: z.string().min(4, "Barkod en az 4 haneli olmalı."),
    categoryId: z.string().min(1, "Kategori seçin."),
    brand: z.string().min(1, "Marka zorunlu."),
    unit: z.string().min(1, "Birim zorunlu."),
    purchasePrice: z.coerce.number().positive("Alış fiyatı 0'dan büyük olmalı."),
    salePrice: z.coerce.number().positive("Satış fiyatı 0'dan büyük olmalı."),
    minStock: z.coerce.number().int().min(0, "Minimum stok negatif olamaz."),
    maxStock: z.coerce.number().int().min(1, "Maksimum stok en az 1 olmalı."),
    supplierId: z.string().min(1, "Tedarikçi seçin."),
  })
  .refine((v) => v.maxStock >= v.minStock, {
    message: "Maksimum stok, minimum stoktan küçük olamaz.",
    path: ["maxStock"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSaved: (values: FormValues) => Promise<void>;
}) {
  const { pending, guard } = useSubmitGuard();
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      categoryId: "",
      brand: "",
      unit: "Adet",
      purchasePrice: 0,
      salePrice: 0,
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
              purchasePrice: product.purchasePrice,
              salePrice: product.salePrice,
              minStock: product.minStock,
              maxStock: product.maxStock,
              supplierId: product.supplierId,
            }
          : {
              name: "",
              sku: "",
              barcode: "",
              categoryId: "",
              brand: "",
              unit: "Adet",
              purchasePrice: 0,
              salePrice: 0,
              minStock: 5,
              maxStock: 50,
              supplierId: "",
            },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      await onSaved(values);
      toast.success(product ? "Ürün güncellendi." : "Ürün oluşturuldu.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
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
                        <SelectValue placeholder="Kategori seçin" />
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alış Fiyatı (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Satış Fiyatı (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        <SelectValue placeholder="Tedarikçi seçin" />
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

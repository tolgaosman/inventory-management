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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import type { Warehouse } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Depo adı en az 2 karakter olmalı."),
  city: z.string().min(2, "Şehir gereklidir."),
  address: z.string(),
  capacity: z.coerce.number().int().positive("Kapasite 0'dan büyük olmalıdır."),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface WarehouseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
  onSaved: (values: FormValues) => Promise<void>;
}

export function WarehouseFormSheet({ open, onOpenChange, warehouse, onSaved }: WarehouseFormSheetProps) {
  const { pending, guard } = useSubmitGuard();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", city: "", address: "", capacity: 10000 },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        warehouse
          ? { name: warehouse.name, city: warehouse.city, address: warehouse.address, capacity: warehouse.capacity }
          : { name: "", city: "", address: "", capacity: 10000 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warehouse]);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      await onSaved(values);
      toast.success(warehouse ? "Depo bilgileri güncellendi." : "Yeni depo oluşturuldu.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{warehouse ? "Depo Bilgilerini Düzenle" : "Yeni Depo Tanımla"}</SheetTitle>
          <SheetDescription>
            {warehouse ? "Depo bilgilerini güncelleyin." : "Envantere yeni bir depo ekleyin."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Depo Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Lefkoşa Kampüs Ana Depo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şehir</FormLabel>
                  <FormControl>
                    <Input placeholder="Lefkoşa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açık Adres</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[60px]" placeholder="Yakın Doğu Bulvarı No:1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapasite</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} value={field.value as number | string} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="flex-row justify-end gap-2 px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <SubmitButton type="submit" pending={pending}>
                {warehouse ? "Değişiklikleri Kaydet" : "Depo Ekle"}
              </SubmitButton>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

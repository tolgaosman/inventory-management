"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import type { Supplier } from "@/lib/types";

const MIN_EMAILS = 3;

const schema = z.object({
  name: z.string().min(2, "Tedarikçi adı en az 2 karakter olmalı."),
  contactName: z.string().min(2, "Yetkili adı gereklidir."),
  emails: z
    .array(z.object({ value: z.string().email("Geçerli bir e-posta girin.") }))
    .min(MIN_EMAILS, `En az ${MIN_EMAILS} e-posta adresi gereklidir.`),
  phone: z.string().min(5, "Telefon gereklidir."),
  city: z.string().min(2, "Şehir gereklidir."),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
export type SupplierFormValues = Omit<FormValues, "emails"> & { emails: string[] };

const EMPTY_EMAIL = { value: "" };
const EMPTY_EMAILS = Array.from({ length: MIN_EMAILS }, () => ({ ...EMPTY_EMAIL }));

interface SupplierFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
  onSaved: (values: SupplierFormValues) => Promise<void>;
}

export function SupplierFormSheet({ open, onOpenChange, supplier, onSaved }: SupplierFormSheetProps) {
  const { pending, guard } = useSubmitGuard();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", contactName: "", emails: EMPTY_EMAILS, phone: "", city: "" },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "emails" });

  useEffect(() => {
    if (open) {
      form.reset(
        supplier
          ? {
              name: supplier.name,
              contactName: supplier.contactName,
              emails: supplier.emails.length > 0 ? supplier.emails.map((value) => ({ value })) : EMPTY_EMAILS,
              phone: supplier.phone,
              city: supplier.city,
            }
          : { name: "", contactName: "", emails: EMPTY_EMAILS, phone: "", city: "" },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier]);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      await onSaved({ ...values, emails: values.emails.map((e) => e.value) });
      toast.success(supplier ? "Tedarikçi bilgileri güncellendi." : "Yeni tedarikçi eklendi.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{supplier ? "Tedarikçi Bilgilerini Düzenle" : "Yeni Tedarikçi Tanımla"}</SheetTitle>
          <SheetDescription>
            {supplier ? "Tedarikçi bilgilerini güncelleyin." : "Envantere yeni bir tedarikçi ekleyin."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tedarikçi Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Cisco Systems Türkiye" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yetkili Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Ahmet Yılmaz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>E-posta Adresleri</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_EMAIL })}>
                  <Plus className="size-4 mr-2" />
                  Ekle
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">En az {MIN_EMAILS} e-posta adresi girin.</p>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`emails.${index}.value`}
                    render={({ field: inputField }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input type="email" placeholder="ahmet@cisco.com" {...inputField} />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= MIN_EMAILS}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input placeholder="0533 111 22 33" {...field} />
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
                    <Input placeholder="İstanbul" {...field} />
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
                {supplier ? "Değişiklikleri Kaydet" : "Tedarikçi Ekle"}
              </SubmitButton>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

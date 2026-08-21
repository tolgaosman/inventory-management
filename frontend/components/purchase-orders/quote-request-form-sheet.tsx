"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SteppedFormDialog } from "@/components/common/stepped-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { useCurrency, type CurrencyCode } from "@/lib/currency-context";
import { CURRENCY_SYMBOLS } from "@/lib/export/report-data";
import { createQuoteRequest, type QuoteItemInput } from "@/lib/api/quotes";

import { ApiError } from "@/lib/api/client";

const CURRENCIES = ["try", "usd", "eur", "gbp"] as const;

const schema = z.object({
  validUntil: z.string().min(1, "Teklif geçerlilik tarihi gerekli."),
  deliveryDate: z.string().min(1, "İstenen teslim tarihi gerekli."),
  deliveryAddress: z.string().min(1, "Teslim adresi gerekli."),
  paymentTerms: z.string().min(1, "Ödeme şartı gerekli."),
  requestedCurrency: z.enum(CURRENCIES),
  contactName: z.string().min(1, "İlgili kişi gerekli."),
  contactEmail: z.string().min(1, "E-posta gerekli.").email("Geçerli bir e-posta girin."),
  contactPhone: z.string().min(1, "Telefon gerekli."),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Today + `days`, as a `yyyy-MM-dd` string for a native date input. */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface QuoteRequestFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName?: string;
  supplierId?: string;
  adhocSupplierName?: string;
  adhocSupplierEmail?: string;
  items: QuoteItemInput[];
  onCreated: () => void;
}

export function QuoteRequestFormSheet({
  open,
  onOpenChange,
  supplierName,
  supplierId,
  adhocSupplierName,
  adhocSupplierEmail,
  items,
  onCreated,
}: QuoteRequestFormSheetProps) {
  const { pending, guard } = useSubmitGuard();
  const { name, can } = useAuth();
  const { company, userProfile } = useSettings();
  const { currency } = useCurrency();

  const summary = useMemo(
    () => ({
      itemCount: items.length,
      qtyCount: items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    [items],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      validUntil: addDays(14),
      deliveryDate: "",
      deliveryAddress: "",
      paymentTerms: "30 gün vadeli",
      requestedCurrency: currency as CurrencyCode,
      contactName: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
      contactEmail: userProfile.email,
      contactPhone: userProfile.phone,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      validUntil: addDays(14),
      deliveryDate: "",
      deliveryAddress: `${company.address}`,
      paymentTerms: "30 gün vadeli",
      requestedCurrency: currency as CurrencyCode,
      contactName: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
      contactEmail: userProfile.email,
      contactPhone: userProfile.phone,
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      try {
        await createQuoteRequest({
          supplierId,
          adhocSupplierName,
          adhocSupplierEmail,
          items,
          validUntil: new Date(values.validUntil).toISOString(),
          deliveryDate: new Date(values.deliveryDate).toISOString(),
          deliveryAddress: values.deliveryAddress,
          paymentTerms: values.paymentTerms,
          requestedCurrency: values.requestedCurrency,
          contactName: values.contactName,
          contactEmail: values.contactEmail,
          contactPhone: values.contactPhone,
          notes: values.notes,
          createdBy: name,
        });
        toast.success(can("purchase.approve") ? "Teklif formu başarıyla oluşturuldu." : "Teklif formu onaya gönderildi.");
        onOpenChange(false);
        onCreated();
      } catch (err) {
        toast.error("Teklif formu oluşturulamadı", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Form {...form}>
      <SteppedFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Teklif İstek Formu"
        description={supplierName ? `${supplierName} için teklif isteği hazırlayın.` : "Teklif isteği detaylarını girin."}
        submitLabel="Teklif Formu Oluştur"
        isSubmitting={pending}
        onSubmit={form.handleSubmit(onSubmit)}
        steps={[
          {
            id: "delivery",
            label: "Teslimat & Ödeme",
            onValidate: () => form.trigger(["validUntil", "deliveryDate", "deliveryAddress", "paymentTerms", "requestedCurrency"]),
            content: (
              <div className="space-y-4">
                {summary.itemCount > 0 && (
                  <div className="mb-4 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground border border-border/50">
                    <span className="font-medium text-foreground">{summary.itemCount} kalem</span>
                    {" · "}
                    {summary.qtyCount} adet
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teklif Geçerlilik Tarihi</FormLabel>
                        <FormControl>
                          <Input type="date" min={today} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İstenen Teslim Tarihi</FormLabel>
                        <FormControl>
                          <Input type="date" min={today} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="deliveryAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teslim Adresi</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ödeme Şartı</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requestedCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teklif Para Birimi</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Para birimi seçin">
                                {field.value
                                  ? `${field.value.toUpperCase()} (${CURRENCY_SYMBOLS[field.value as CurrencyCode]})`
                                  : "Para birimi seçin"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map((code) => (
                              <SelectItem key={code} value={code}>
                                {code.toUpperCase()} ({CURRENCY_SYMBOLS[code]})
                              </SelectItem>
                            ))}
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
            id: "contact",
            label: "İletişim Bilgileri",
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İlgili Kişi</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notlar (opsiyonel)</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ),
          },
        ]}
      />
    </Form>
  );
}

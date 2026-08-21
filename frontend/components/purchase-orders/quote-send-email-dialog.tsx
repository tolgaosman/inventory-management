"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsync } from "@/lib/hooks/use-async";
import { useSettings } from "@/lib/settings-context";
import { getQuoteRequest, type QuoteRequestRow } from "@/lib/api/quotes";
import { formatDate } from "@/lib/format";

interface QuoteSendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteRequestRow | null;
}

function buildMailtoTemplate(params: {
  code: string;
  supplierName: string;
  validUntil: string;
  deliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  companyName: string;
}): { subject: string; body: string } {
  const subject = `Teklif Talebi ${params.code}`;
  const body = [
    "Sayın Yetkili,",
    "",
    `${params.code} numaralı teklif talebimizi aşağıda bulabilirsiniz.`,
    "",
    `Geçerlilik Tarihi: ${formatDate(params.validUntil)}`,
    `Teslimat Tarihi: ${formatDate(params.deliveryDate)}`,
    `Teslimat Adresi: ${params.deliveryAddress}`,
    `Ödeme Koşulları: ${params.paymentTerms}`,
    "",
    "Not: Teklif belgesinin PDF çıktısını lütfen bu e-postaya ayrıca ekleyin (\"PDF İndir\" ile indirip ekleyebilirsiniz).",
    "",
    "Saygılarımızla,",
    params.companyName,
  ].join("\n");
  return { subject, body };
}

export function QuoteSendEmailDialog({ open, onOpenChange, quote }: QuoteSendEmailDialogProps) {
  const { company } = useSettings();
  const [selectedEmail, setSelectedEmail] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customEmailTouched, setCustomEmailTouched] = useState(false);

  const { data: detail, status } = useAsync(
    () => (open && quote ? getQuoteRequest(quote.id) : Promise.resolve(null)),
    [open, quote?.id],
  );

  const hasRealSupplier = Boolean(detail?.supplier);
  const supplierName = detail?.supplier?.name ?? detail?.adhocSupplierName ?? "Tedarikçi";

  useEffect(() => {
    if (open) {
      setUseOther(false);
      setCustomEmail("");
      setCustomEmailTouched(false);
    }
  }, [open]);

  useEffect(() => {
    if (detail?.supplier?.emails.length) {
      setSelectedEmail(detail.supplier.emails[0]);
    } else if (detail && !detail.supplier) {
      // No supplier record (adhoc supplier) — there's nowhere to pick an email from.
      setUseOther(true);
      if (detail.adhocSupplierEmail) {
        setCustomEmail(detail.adhocSupplierEmail);
      }
    }
  }, [detail]);

  const customEmailValid = customEmail.includes("@");
  const targetEmail = useOther ? customEmail.trim() : selectedEmail;
  const canSend = Boolean(detail) && (useOther ? customEmailValid : Boolean(selectedEmail));

  function handleSend() {
    if (!detail) return;
    if (useOther && !customEmailValid) {
      setCustomEmailTouched(true);
      return;
    }

    const { subject, body } = buildMailtoTemplate({
      code: detail.code,
      supplierName,
      validUntil: detail.validUntil,
      deliveryDate: detail.deliveryDate,
      deliveryAddress: detail.deliveryAddress,
      paymentTerms: detail.paymentTerms,
      companyName: company.companyName,
    });

    window.location.href = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success("Varsayılan e-posta uygulamanız açıldı.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Teklifi E-posta ile Gönder</DialogTitle>
          <DialogDescription>
            {detail ? `${supplierName} tedarikçisine gönderilecek e-postayı seçin.` : "Teklif bilgileri yükleniyor…"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {status === "loading" && (
            <div className="flex justify-center p-4">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {detail && (
            <>
              {!useOther && detail.supplier && (
                <div className="space-y-2">
                  <Label>Tedarikçi E-postası</Label>
                  <Select value={selectedEmail} onValueChange={(value) => setSelectedEmail(value ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="E-posta seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {detail.supplier.emails.map((email) => (
                        <SelectItem key={email} value={email}>{email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasRealSupplier && (
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="use-other-email"
                    checked={useOther}
                    onCheckedChange={(checked) => setUseOther(!!checked)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="use-other-email" className="font-medium cursor-pointer">
                      Farklı bir adrese gönder
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Tedarikçinin kayıtlı e-postaları dışında bir adrese göndermek için işaretleyin.
                    </p>
                  </div>
                </div>
              )}

              {!hasRealSupplier && (
                <p className="text-xs text-muted-foreground">
                  Bu teklif henüz kayıtlı olmayan bir tedarikçiye ({supplierName}) ait — gönderilecek e-postayı elle girin.
                </p>
              )}

              {useOther && (
                <div className="space-y-1.5">
                  <Input
                    type="email"
                    placeholder="ornek@tedarikci.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    onBlur={() => setCustomEmailTouched(true)}
                    aria-invalid={customEmailTouched && !customEmailValid}
                  />
                  {customEmailTouched && !customEmailValid && (
                    <p className="text-xs text-destructive">Geçerli bir e-posta adresi girin.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            <Mail className="size-4" />
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

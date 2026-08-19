"use client";

import { useState } from "react";
import { Lock, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { changePassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Admin-created accounts start with a shared, known default password (see
 * backend UserController::store) — this blocks the whole app behind a
 * mandatory password change until the user sets their own. Not dismissable:
 * no close button, and since `open` is controlled with no onOpenChange,
 * Escape/backdrop-click have nothing to call.
 */
export function MustChangePasswordGate({ children }: { children: React.ReactNode }) {
  const { mustChangePassword, refresh } = useAuth();

  return (
    <>
      {children}
      <Dialog open={mustChangePassword}>
        <DialogContent showCloseButton={false}>
          <ForcedChangePasswordForm onSuccess={refresh} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ForcedChangePasswordForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirmation) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword, newPasswordConfirmation });
      await onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre güncellenemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Şifrenizi değiştirin</DialogTitle>
        <DialogDescription>
          Hesabınız varsayılan bir şifreyle oluşturuldu. Devam etmeden önce kendi şifrenizi belirlemelisiniz.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            placeholder="Mevcut şifre"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Yeni şifre"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Yeni şifre (tekrar)"
            autoComplete="new-password"
            value={newPasswordConfirmation}
            onChange={(e) => setNewPasswordConfirmation(e.target.value)}
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
        </Button>
      </DialogFooter>
    </form>
  );
}

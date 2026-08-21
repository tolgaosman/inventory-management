"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Plus, Pencil, Trash2, Users, Lock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { Section, SectionStack } from "@/components/common/section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
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
import { RoleFormSheet } from "@/components/users/role-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { listRoles, deleteRole, type RoleRow } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";

export function RolesClient() {
  const { data, staleData, status, refetch } = useAsync(() => listRoles(), []);
  const roles = data ?? staleData ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | undefined>(undefined);
  const [deleting, setDeleting] = useState<RoleRow | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteRole(deleting.id);
      toast.success("Rol silindi.", { description: deleting.name });
      setDeleting(undefined);
      refetch();
    } catch (err) {
      toast.error("Rol silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  return (
    <Can permission="roles.manage" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Roller"
          description="Sistemdeki rolleri görüntüleyin, yeni roller oluşturun ve izinlerini düzenleyin."
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Yeni Rol
            </Button>
          }
        />

        <SectionStack>
          <Section index={0}>
            {status === "loading" && roles.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</CardContent>
              </Card>
            ) : roles.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState icon={ShieldCheck} title="Henüz rol yok" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map((role) => (
                  <Card key={role.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{role.name}</p>
                        </div>
                        {role.isSystem && (
                          <Badge variant="outline" className="shrink-0 gap-1 border-0 bg-muted text-xs text-muted-foreground">
                            <Lock className="size-3" />
                            Sistem Rolü
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {formatNumber(role.userCount)} kullanıcı
                        <span className="text-muted-foreground/50">·</span>
                        {formatNumber(role.permissions.length)} izin
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 6).map((p) => (
                          <Badge key={p} variant="outline" className="border-0 bg-muted/70 text-[11px] font-normal text-muted-foreground">
                            {p}
                          </Badge>
                        ))}
                        {role.permissions.length > 6 && (
                          <Badge variant="outline" className="border-0 bg-muted/70 text-[11px] font-normal text-muted-foreground">
                            +{role.permissions.length - 6}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-auto flex justify-end gap-1 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <Pencil className="size-3.5" />
                          Düzenle
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={role.isSystem || role.userCount > 0}
                          title={
                            role.isSystem
                              ? "Sistem rolleri silinemez."
                              : role.userCount > 0
                                ? "Bu role sahip kullanıcılar olduğu için silinemez."
                                : undefined
                          }
                          onClick={() => setDeleting(role)}
                        >
                          <Trash2 className="size-3.5" />
                          Sil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </SectionStack>

        <RoleFormSheet open={formOpen} onOpenChange={setFormOpen} role={editing} onSaved={refetch} />

        <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rolü sil</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting ? `"${deleting.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive-solid" onClick={handleDelete}>
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Roller" />
      <ForbiddenState message="Rolleri yönetmek için yetkiniz yok." />
    </div>
  );
}

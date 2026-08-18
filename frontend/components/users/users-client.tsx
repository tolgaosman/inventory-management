"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Shield,
  UserCog,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Warehouse,
  ShoppingCart,
  ArrowUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { DataTableColumnFilter } from "@/components/data-table/data-table-filter";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { users as mockUsers } from "@/lib/mock/data";
import { ROLE_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppUser, Role } from "@/lib/types";

const ROLE_STYLE: Record<Role, { bg: string; text: string; icon: React.ElementType }> = {
  yonetici: { bg: "bg-tint-plum/15", text: "text-tint-plum", icon: ShieldCheck },
  depo: { bg: "bg-tint-teal/15", text: "text-tint-teal", icon: Warehouse },
  satinalma: { bg: "bg-tint-amber/15", text: "text-tint-amber", icon: ShoppingCart },
};

function RoleBadge({ role }: { role: Role }) {
  const style = ROLE_STYLE[role];
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border-0 font-semibold text-xs", style.bg, style.text)}>
      <Icon className="size-3" />
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function UsersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [userList, setUserList] = useState<AppUser[]>([...mockUsers]);
  const [sortByRole, setSortByRole] = useState(false);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | undefined>(undefined);
  const [formValues, setFormValues] = useState({ name: "", email: "", role: "depo" as Role });

  // Delete dialog state
  const [deleting, setDeleting] = useState<AppUser | undefined>(undefined);

  const filtered = useMemo(() => {
    let result: AppUser[] = userList.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!searchInput) return true;
      const q = searchInput.toLocaleLowerCase("tr-TR");
      return (
        u.name.toLocaleLowerCase("tr-TR").includes(q) ||
        u.email.toLocaleLowerCase("tr-TR").includes(q)
      );
    });

    if (sortByRole) {
      result = [...result].sort((a, b) => a.role.localeCompare(b.role));
    }

    return result;
  }, [userList, searchInput, roleFilter, sortByRole]);

  const stats = useMemo(() => {
    const total = userList.length;
    const admins = userList.filter((u) => u.role === "yonetici").length;
    const warehouse = userList.filter((u) => u.role === "depo").length;
    const purchasing = userList.filter((u) => u.role === "satinalma").length;
    return { total, admins, warehouse, purchasing };
  }, [userList]);

  function openCreate() {
    setEditing(undefined);
    setFormValues({ name: "", email: "", role: "depo" });
    setFormOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditing(user);
    setFormValues({ name: user.name, email: user.email, role: user.role });
    setFormOpen(true);
  }

  function handleSave() {
    if (!formValues.name.trim() || !formValues.email.trim()) {
      toast.error("Ad ve e-posta alanları zorunludur.");
      return;
    }

    const initials = formValues.name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    if (editing) {
      setUserList((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? { ...u, name: formValues.name.trim(), email: formValues.email.trim(), role: formValues.role, initials }
            : u,
        ),
      );
      toast.success("Kullanıcı güncellendi.", { description: `${formValues.name} bilgileri kaydedildi.` });
    } else {
      const newUser: AppUser = {
        id: String(10000 + Math.floor(Math.random() * 90000)),
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        role: formValues.role,
        initials,
      };
      setUserList((prev) => [...prev, newUser]);
      toast.success("Kullanıcı oluşturuldu.", { description: `${formValues.name} sisteme eklendi.` });
    }
    setFormOpen(false);
  }

  function handleDelete() {
    if (!deleting) return;
    setUserList((prev) => prev.filter((u) => u.id !== deleting.id));
    toast.success("Kullanıcı silindi.", { description: `${deleting.name} sistemden kaldırıldı.` });
    setDeleting(undefined);
  }

  const isFiltered = Boolean(searchInput || roleFilter !== "all");

  return (
    <Can permission="users.manage" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Kullanıcı Yönetimi"
          description="Sisteme kayıtlı kullanıcıları görüntüleyin, rolleri yönetin."
          actions={
            <Can permission="users.manage">
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Yeni Kullanıcı
              </Button>
            </Can>
          }
        />

        <SectionStack>
          <Section index={0}>
            <StatGrid
              className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              items={[
                { icon: Users, tint: "blue", label: "Toplam Kullanıcı", value: formatNumber(stats.total) },
                { icon: ShieldCheck, tint: "plum", label: "Yönetici", value: formatNumber(stats.admins) },
                { icon: Warehouse, tint: "teal", label: "Depo Personeli", value: formatNumber(stats.warehouse) },
                { icon: ShoppingCart, tint: "amber", label: "Satın Alma", value: formatNumber(stats.purchasing) },
              ]}
            />
          </Section>

          <Section index={1}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Ad veya e-posta ara…"
                    className="h-9 pl-8"
                  />
                </div>
                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput("");
                      setRoleFilter("all");
                    }}
                    className="shrink-0"
                  >
                    <X className="size-4" />
                    Temizle
                  </Button>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section index={2}>
            <Card className="overflow-hidden py-0 gap-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-left">Kullanıcı</TableHead>
                    <TableHead className="text-center">ID</TableHead>
                    <TableHead className="text-center">E-posta</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSortByRole((prev) => !prev)}
                          className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors group"
                        >
                          Rol
                          <ArrowUpDown className={cn(
                            "size-3.5 transition-colors", 
                            sortByRole ? "text-foreground" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                          )} />
                        </button>
                        <DataTableColumnFilter
                          value={roleFilter}
                          onValueChange={setRoleFilter}
                          options={[
                            { label: "Yönetici", value: "yonetici" },
                            { label: "Depo Personeli", value: "depo" },
                            { label: "Satın Alma Personeli", value: "satinalma" }
                          ]}
                          title="Rol Seç"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-16 pr-5 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-4">
                        <EmptyState
                          icon={Users}
                          title={isFiltered ? "Eşleşen kullanıcı yok" : "Henüz kullanıcı yok"}
                          description={
                            isFiltered
                              ? "Arama kriterlerine uyan kullanıcı bulunamadı."
                              : "Sisteme henüz bir kullanıcı eklenmemiş."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((user) => (
                      <TableRow
                        key={user.id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                ROLE_STYLE[user.role].bg,
                                ROLE_STYLE[user.role].text,
                              )}
                            >
                              {user.initials}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {user.name}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <span className="font-mono text-xs text-muted-foreground">#{user.id}</span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="flex justify-center">
                            <RoleBadge role={user.role} />
                          </div>
                        </TableCell>
                        <TableCell className="w-16 pr-5 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Pencil className="size-4" />
                                Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(user)}>
                                <Trash2 className="size-4" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </Section>
        </SectionStack>

        {/* ── Create / Edit Dialog ──────────────────────────────────────── */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="size-4 text-primary" />
                {editing ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı Oluştur"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Kullanıcı bilgilerini ve rolünü güncelleyin."
                  : "Sisteme yeni bir kullanıcı ekleyin ve rolünü belirleyin."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">Ad Soyad</Label>
                <Input
                  id="user-name"
                  value={formValues.name}
                  onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">E-posta</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formValues.email}
                  onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
                  placeholder="ahmet@sirket.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Rol</Label>
                <Select
                  value={formValues.role}
                  onValueChange={(v) => setFormValues((prev) => ({ ...prev, role: v as Role }))}
                >
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue>{ROLE_LABELS[formValues.role]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yonetici">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-3.5 text-tint-plum" />
                        Yönetici
                      </div>
                    </SelectItem>
                    <SelectItem value="depo">
                      <div className="flex items-center gap-2">
                        <Warehouse className="size-3.5 text-tint-teal" />
                        Depo Personeli
                      </div>
                    </SelectItem>
                    <SelectItem value="satinalma">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="size-3.5 text-tint-amber" />
                        Satın Alma Personeli
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Vazgeç
              </Button>
              <Button onClick={handleSave}>
                {editing ? "Kaydet" : "Oluştur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation ───────────────────────────────────────── */}
        <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kullanıcıyı sil</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting
                  ? `"${deleting.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`
                  : ""}
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
      <PageHeader title="Kullanıcı Yönetimi" />
      <ForbiddenState message="Kullanıcıları yönetmek için yetkiniz yok." />
    </div>
  );
}

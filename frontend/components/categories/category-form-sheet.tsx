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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import type { Category } from "@/lib/types";

/** Sentinel value for "no parent" — Base UI's Select cannot hold an empty string. */
const ROOT = "__root__";

const schema = z.object({
  name: z.string().min(2, "Kategori adı en az 2 karakter olmalı."),
  parentId: z.string(),
});

type FormValues = z.output<typeof schema>;

export interface CategoryFormValues {
  name: string;
  parentId: string | null;
}

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; omitted when creating. */
  category?: Category;
  /** Pre-selected parent when creating a child from a root category's menu. */
  defaultParentId?: string | null;
  /** Roots that are eligible parents, plus the flat list used for exclusions. */
  allCategories: Category[];
  onSaved: (values: CategoryFormValues) => Promise<void>;
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  category,
  defaultParentId,
  allCategories,
  onSaved,
}: CategoryFormSheetProps) {
  const { pending, guard } = useSubmitGuard();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", parentId: ROOT },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        parentId: (category ? category.parentId : defaultParentId) ?? ROOT,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, defaultParentId]);

  // A category that already has children cannot become a child itself, so it
  // is also not offered as a parent for anything but a fresh root.
  const hasChildren = category ? allCategories.some((c) => c.parentId === category.id) : false;
  const parentOptions = allCategories.filter((c) => c.parentId === null && c.id !== category?.id);

  async function onSubmit(values: FormValues) {
    await guard(async () => {
      await onSaved({
        name: values.name,
        parentId: values.parentId === ROOT ? null : values.parentId,
      });
      toast.success(category ? "Kategori güncellendi." : "Kategori oluşturuldu.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{category ? "Kategoriyi Düzenle" : "Yeni Kategori"}</SheetTitle>
          <SheetDescription>
            {category
              ? "Kategori adını değiştirin veya başka bir üst kategoriye taşıyın."
              : "Yeni bir üst kategori ya da mevcut bir kategorinin altına alt kategori oluşturun."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Kurumsal Laptop" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Üst Kategori</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange((v as string) ?? ROOT)}
                    disabled={hasChildren}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {field.value === ROOT
                            ? "Üst kategori yok (kök)"
                            : (parentOptions.find((c) => c.id === field.value)?.name ?? "Üst kategori seçin")}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ROOT}>Üst kategori yok (kök)</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {hasChildren
                      ? "Alt kategorileri olduğu için bu kategori başka bir kategorinin altına taşınamaz."
                      : "Kategori ağacı en fazla 2 seviye derinliğindedir."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="flex-row justify-end gap-2 px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <SubmitButton type="submit" pending={pending}>
                {category ? "Kaydet" : "Kategoriyi Oluştur"}
              </SubmitButton>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

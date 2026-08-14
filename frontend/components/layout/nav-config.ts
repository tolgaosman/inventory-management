import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Package,
  FolderTree,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Truck,
  ShoppingCart,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import type { Permission } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  children?: NavItem[];
}

/** A labelled run of nav items. Sections whose items are all denied by the
 *  permission filter are dropped along with their heading. */
export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Genel",
    items: [{ label: "Panel", href: "/panel", icon: LayoutGrid }],
  },
  {
    label: "Envanter",
    items: [
      { label: "Ürün Yönetimi", href: "/urunler", icon: Package, permission: "products.view" },
      { label: "Kategoriler", href: "/kategoriler", icon: FolderTree, permission: "products.view" },
      { label: "Depolar", href: "/depolar", icon: Warehouse, permission: "products.view" },
    ],
  },
  {
    label: "Operasyon",
    items: [
      {
        label: "Stok Hareketleri",
        href: "/stok/hareketler",
        icon: History,
        permission: "stock.in",
        children: [
          { label: "Giriş / Çıkış İşlemleri", href: "/stok/islem", icon: ArrowLeftRight, permission: "stock.in" },
          { label: "Transfer", href: "/stok/transfer", icon: ArrowLeftRight, permission: "stock.transfer" },
          { label: "Hareket Geçmişi", href: "/stok/hareketler", icon: History, permission: "stock.in" },
        ],
      },
      { label: "Tedarikçiler", href: "/tedarikciler", icon: Truck, permission: "suppliers.view" },
      { label: "Satın Alma", href: "/satin-alma", icon: ShoppingCart, permission: "purchase.view" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { label: "Raporlar", href: "/raporlar", icon: BarChart3, permission: "reports.view" },

      { label: "Ayarlar", href: "/ayarlar", icon: Settings },
    ],
  },
];

/** Flat list, kept for consumers that don't care about grouping. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

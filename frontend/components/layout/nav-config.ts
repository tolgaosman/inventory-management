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

export const NAV_ITEMS: NavItem[] = [
  { label: "Panel", href: "/panel", icon: LayoutGrid },
  { label: "Ürünler", href: "/urunler", icon: Package, permission: "products.view" },
  { label: "Kategoriler", href: "/kategoriler", icon: FolderTree, permission: "products.view" },
  { label: "Depolar", href: "/depolar", icon: Warehouse, permission: "products.view" },
  {
    label: "Stok Hareketleri",
    href: "/stok/hareketler",
    icon: History,
    permission: "stock.in",
    children: [
      { label: "Stok Girişi", href: "/stok/giris", icon: ArrowDownToLine, permission: "stock.in" },
      { label: "Stok Çıkışı", href: "/stok/cikis", icon: ArrowUpFromLine, permission: "stock.out" },
      { label: "Transfer", href: "/stok/transfer", icon: ArrowLeftRight, permission: "stock.transfer" },
      { label: "Hareket Geçmişi", href: "/stok/hareketler", icon: History, permission: "stock.in" },
    ],
  },
  { label: "Tedarikçiler", href: "/tedarikciler", icon: Truck, permission: "suppliers.view" },
  { label: "Satın Alma", href: "/satin-alma", icon: ShoppingCart, permission: "purchase.view" },
  { label: "Raporlar", href: "/raporlar", icon: BarChart3, permission: "reports.view" },
  { label: "Kullanıcılar", href: "/kullanicilar", icon: Users, permission: "users.manage" },
  { label: "Ayarlar", href: "/ayarlar", icon: Settings },
];

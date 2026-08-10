import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toaster } from "@/components/ui/Toaster";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <NavigationGuardProvider>
        <div className="flex h-screen overflow-hidden bg-canvas">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
          <Toaster />
        </div>
      </NavigationGuardProvider>
    </SessionGuard>
  );
}

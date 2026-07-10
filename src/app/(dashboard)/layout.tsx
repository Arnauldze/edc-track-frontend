import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/Toaster";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-row min-h-screen h-screen overflow-hidden bg-[var(--bg-root)] transition-colors duration-200">
            <Sidebar />
            <main className="flex-1 overflow-y-auto w-full transition-colors duration-200 bg-[var(--bg-root)]">
                {children}
            </main>
            <Toaster />
        </div>
    );
}

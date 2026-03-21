import { Sidebar } from "@/components/layout/Sidebar";
import { LogWorkoutButton } from "@/components/layout/LogWorkoutButton";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-4 md:justify-end md:px-6 sticky top-0 bg-background z-10">
          <span className="font-bold text-base md:hidden">Pi Fitness</span>
          <LogWorkoutButton />
        </header>
        {/* pb-16 on mobile clears the fixed bottom nav */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
    </div>
  );
}

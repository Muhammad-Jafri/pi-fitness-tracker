import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { LogWorkoutButton } from "@/components/layout/LogWorkoutButton";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pi Fitness Tracker",
  description: "Personal fitness tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b flex items-center justify-end px-6 sticky top-0 bg-background z-10">
              <LogWorkoutButton />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

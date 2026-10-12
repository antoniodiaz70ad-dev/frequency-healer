"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

/** Public landing routes opt out of the existing application frame. */
export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const landing = pathname === "/" || pathname === "/landing";
  return landing ? (
    <main>{children}</main>
  ) : (
    <>
      <Sidebar />
      <main className="md:ml-64 p-4 pt-16 md:p-8 md:pt-8 min-h-screen">
        {children}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Frequency Healer",
  description: "Generador de frecuencias para sanacion de cuerpo, alma y espiritu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-screen bg-[#030712] text-[#e5e7eb]">
        <Sidebar />
        <main className="md:ml-64 p-4 pt-16 md:p-8 md:pt-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}

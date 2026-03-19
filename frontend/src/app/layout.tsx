import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Frequency Healer — Sanación con Frecuencias",
  description: "Genera tonos terapéuticos, beats binaurales y protocolos de frecuencias para bienestar físico, emocional y espiritual.",
  keywords: ["frecuencias", "sanación", "solfeggio", "binaural", "rife", "meditación", "432 Hz", "frequency healing"],
  openGraph: {
    title: "Frequency Healer",
    description: "Sanación con frecuencias terapéuticas para cuerpo, alma y espíritu.",
    type: "website",
    locale: "es_ES",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#030712" />
      </head>
      <body className="min-h-screen bg-[#030712] text-[#e5e7eb]">
        <Sidebar />
        <main className="md:ml-64 p-4 pt-16 md:p-8 md:pt-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}

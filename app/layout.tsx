import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";
import QueryProvider from "@/components/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: "MisterWheels - Car Rental Management",
  description: "Car Rental Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SessionProviderWrapper>
          <QueryProvider>{children}</QueryProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

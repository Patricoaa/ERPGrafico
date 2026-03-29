import type { Metadata } from "next";
import { Syne, Onest } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/auth/AuthGuard"
import { AuthProvider } from "@/contexts/AuthContext"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"
import { HubPanelProvider } from "@/components/providers/HubPanelProvider"
import Providers from "./providers"

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERPGrafico",
  description: "ERP Contable para Imprenta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${syne.variable} ${onest.variable} font-sans antialiased`}
      >
        <Providers>
          <AuthProvider>
            <HubPanelProvider>
              <GlobalModalProvider>
                {children}
              </GlobalModalProvider>
            </HubPanelProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

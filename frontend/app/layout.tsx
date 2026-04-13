import type { Metadata } from "next";
import { Syne, Onest } from "next/font/google";
import { GlobalHubPanel } from "@/features/orders/components/GlobalHubPanel";
import "./globals.css";
import AuthGuard from "@/components/auth/AuthGuard"
import { AuthProvider } from "@/contexts/AuthContext"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"
import { HubPanelProvider } from "@/components/providers/HubPanelProvider"
import { HeaderProvider } from "@/components/providers/HeaderProvider"
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
        <a href="#main-content" className="skip-to-content">
          Ir al contenido principal
        </a>
        <Providers>
          <AuthProvider>
            <HeaderProvider>
              <HubPanelProvider>
                <GlobalModalProvider>
                  {children}
                  <GlobalHubPanel />
                </GlobalModalProvider>
              </HubPanelProvider>
            </HeaderProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

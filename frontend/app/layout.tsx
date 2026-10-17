import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"
import { HeaderProvider } from "@/components/providers/HeaderProvider"
import { RealtimeProvider } from "@/features/realtime"
import Providers from "./providers"

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${onest.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <a href="#main-content" className="skip-to-content">
          Ir al contenido principal
        </a>
        <Providers>
          <AuthProvider>
            <RealtimeProvider>
              <HeaderProvider>
                <GlobalModalProvider>
                    {children}
                    {/* Target portal container for module sheets to avoid containing blocks inside the transitioning container */}
                    <div id="module-sheets-portal-container" className="relative" />
                  </GlobalModalProvider>
              </HeaderProvider>
            </RealtimeProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"
import { HeaderProvider } from "@/components/providers/HeaderProvider"
import { RealtimeProvider } from "@/features/realtime"
import Providers from "./providers"

// Self-hosted (app/fonts, OFL): the build must not depend on reaching Google Fonts — the dev
// server and CI can lose internet and next/font/google then silently falls back to a system font.
// Latin subset, variable weight; same families and CSS variables as before.
const onest = localFont({
  src: "./fonts/Onest-Variable.woff2",
  variable: "--font-onest",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
  // Arial metrics (the default) would misalign a monospace fallback.
  adjustFontFallback: false,
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
        <Providers>
          <AuthProvider>
            <RealtimeProvider>
              <HeaderProvider>
                <GlobalModalProvider>
                    {children}
                    {/* Target portal container for module sheets to avoid containing blocks inside the transitioning container.
                        Fixed full-viewport so embedded drawers (boundary="embedded") anchor to the viewport
                        in layouts without #main-content (e.g., /pos). pointer-events-none lets clicks pass through
                        to the app; SheetContent/SheetOverlay re-enable with pointer-events-auto. */}
                    <div id="module-sheets-portal-container" className="fixed inset-0 pointer-events-none" />
                  </GlobalModalProvider>
              </HeaderProvider>
            </RealtimeProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

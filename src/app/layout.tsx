import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piques",
  description: "Juegos para dos, cada uno desde su móvil. Sin registro ni instalación.",
};

export const viewport: Viewport = {
  themeColor: "#04121f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        {children}
        {/* Analítica de Vercel. La versión `/next` agrupa sola las rutas
            dinámicas, así que las salas se cuentan juntas como /game/[code]
            en vez de una entrada por código. Sólo emite en producción. */}
        <Analytics />
      </body>
    </html>
  );
}

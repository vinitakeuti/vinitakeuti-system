import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { site } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.seo.title,
  description: site.seo.description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", url: site.url, siteName: site.name, title: site.seo.title, description: site.seo.description },
  icons: { icon: "/logo-vr.svg" },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>
    {children}
    {/* Atendimento com IA: botão flutuante servido pela gestão (tema escuro, para o fundo preto do site). */}
    {site.attendanceWidgetUrl ? <Script src={site.attendanceWidgetUrl} strategy="afterInteractive" data-tema="escuro" /> : null}
  </body></html>;
}

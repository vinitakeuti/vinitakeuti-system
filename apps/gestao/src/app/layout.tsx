import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { homeScreenName, portalForRequest } from "@/features/auth/services/auth-host";

export async function generateMetadata(): Promise<Metadata> {
  const name = homeScreenName(portalForRequest(await headers()));
  return {
    title: "Vinicius Riudi | Gestão",
    description: "Operação, finanças e monitoramento de sistemas de Vinicius Riudi.",
    applicationName: name,
    // O iPhone ignora SVG na tela de início: ele usa o apple-touch-icon em PNG, com fundo opaco.
    icons: {
      icon: [{ url: "/assets/icons/icon.svg", type: "image/svg+xml" }, { url: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/assets/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { title: name },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

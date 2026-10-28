import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { homeScreenName, portalForRequest } from "@/features/auth/services/auth-host";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const name = homeScreenName(portalForRequest(await headers()));
  return {
    name,
    short_name: name,
    start_url: "/",
    display: "browser",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

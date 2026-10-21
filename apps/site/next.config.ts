import path from "node:path";
import type { NextConfig } from "next";

// O site mora dentro do repositório da gestão: a raiz do projeto é esta pasta, não a do repositório.
const root = path.resolve(process.cwd());

/** Site institucional (viniciusriudi.com): sem banco nem login, publicado como serviço próprio no Easypanel. */
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    }];
  },
};

export default nextConfig;

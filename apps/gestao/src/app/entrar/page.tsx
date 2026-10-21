import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { getAuthenticatedUser } from "@/features/auth/services/auth-session";
import { isAuthSecretConfigured } from "@/features/auth/services/session-token";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const requestHeaders = await headers();
  const portal = portalForRequest(requestHeaders);
  if (portal === "landing") redirect("/");
  const current = await getAuthenticatedUser();
  if (current?.audience === portal) redirect("/");
  const { erro } = await searchParams;
  return <LoginForm portal={portal} error={isAuthSecretConfigured() ? erro : "configuracao"} />;
}

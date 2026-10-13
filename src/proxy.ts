import { NextRequest, NextResponse } from "next/server";
import { getAuthPortal } from "@/features/auth/services/auth-host";
import { AUTH_SESSION_COOKIE, readSessionToken } from "@/features/auth/services/session-token";
import { prisma } from "@/lib/prisma";

const publicApiPaths = new Set(["/api/health", "/api/webhooks/asaas"]);

function loginResponse(request: NextRequest, isApiRequest: boolean, clearCookie = false) {
  if (isApiRequest) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const response = NextResponse.redirect(new URL("/entrar", request.url));
  if (clearCookie) response.cookies.delete(AUTH_SESSION_COOKIE);
  return response;
}

async function activeSession(request: NextRequest) {
  const token = await readSessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { id: token.sessionId },
    select: { expiresAt: true, user: { select: { role: true, clientId: true, isActive: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) return null;
  const audience = session.user.role === "CLIENT" ? "client" : "management";
  if (audience !== token.audience || (audience === "client" && !session.user.clientId)) return null;
  return { audience };
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const portal = getAuthPortal(request.headers.get("host"));

  if (portal === "landing") {
    if (path === "/") return NextResponse.next();
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isLogin = path === "/entrar";
  const isPublicApi = publicApiPaths.has(path);
  if (isPublicApi) return NextResponse.next();

  const session = await activeSession(request);
  // A rota de login continua pública para que uma sessão revogada consiga
  // exibir o formulário novamente.
  if (isLogin) {
    if (session?.audience === portal) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!session) return loginResponse(request, path.startsWith("/api/"), true);
  if (session.audience !== portal) return loginResponse(request, path.startsWith("/api/"), true);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};

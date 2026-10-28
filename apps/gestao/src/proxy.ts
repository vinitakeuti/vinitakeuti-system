import { NextRequest, NextResponse } from "next/server";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { AUTH_SESSION_COOKIE, readSessionToken } from "@/features/auth/services/session-token";
import { prisma } from "@/lib/prisma";
import { isForgedServerAction } from "@/lib/server-action-guard";

const publicApiPaths = new Set(["/api/health", "/api/webhooks/asaas"]);
/** Páginas do portal do cliente: no domínio de clientes, "/pagamentos" é servido por "/portal/pagamentos". */
const clientPortalPages = new Set(["/", "/servicos", "/pagamentos", "/documentos", "/configuracoes"]);

function isPortalRoute(path: string) {
  return path === "/portal" || path.startsWith("/portal/") || path === "/api/portal" || path.startsWith("/api/portal/");
}

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
  if (await isForgedServerAction(request)) return new NextResponse("Não encontrado.", { status: 404 });
  const path = request.nextUrl.pathname;
  const portal = portalForRequest(request.headers);

  if (portal === "landing") {
    if (path === "/") return NextResponse.next();
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isLogin = path === "/entrar";
  const isPublicApi = publicApiPaths.has(path);
  if (isPublicApi) return NextResponse.next();

  // O domínio de clientes só serve o login, as páginas do portal e a API do portal; o restante da aplicação (gestão
  // e suas APIs) não existe para ele. Na gestão, as rotas do portal não existem.
  let portalPage: string | null = null;
  if (portal === "client") {
    // Arquivos internos do Next.js (recarga no desenvolvimento, sobreposição de erros) seguem sem regra de portal.
    if (!isLogin && !path.startsWith("/api/portal/") && !path.startsWith("/_next/") && !path.startsWith("/__nextjs")) {
      const page = path.length > 1 ? path.replace(/\/+$/, "") : path;
      if (!clientPortalPages.has(page)) return path.startsWith("/api/") ? NextResponse.json({ error: "Não encontrado." }, { status: 404 }) : NextResponse.redirect(new URL("/", request.url));
      portalPage = page === "/" ? "/portal" : `/portal${page}`;
    }
  } else if (isPortalRoute(path)) {
    return new NextResponse("Não encontrado.", { status: 404 });
  }

  const session = await activeSession(request);
  // A rota de login continua pública para que uma sessão revogada consiga
  // exibir o formulário novamente.
  if (isLogin) {
    if (session?.audience === portal) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!session) return loginResponse(request, path.startsWith("/api/"), true);
  if (session.audience !== portal) return loginResponse(request, path.startsWith("/api/"), true);
  if (portalPage) {
    const url = request.nextUrl.clone();
    url.pathname = portalPage;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};

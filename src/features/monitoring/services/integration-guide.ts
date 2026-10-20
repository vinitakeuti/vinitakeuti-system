import { monitoringRules } from "@/lib/monitoring";

/**
 * Instruções para outra IA (ou pessoa) implementar, num sistema de cliente, o endpoint de saúde que o
 * Monitoramento da VR Gestão consulta. O formato descrito aqui é o mesmo que monitoring-service.ts interpreta.
 */
export function monitoringIntegrationGuide({ systemName, siteUrl, healthUrl }: { systemName?: string | null; siteUrl?: string | null; healthUrl?: string | null } = {}) {
  const name = systemName?.trim() || "<nome do sistema>";
  const health = healthUrl?.trim() || (siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/health` : "https://<domínio-do-sistema>/api/health");
  const slow = monitoringRules.slowResponseMs;
  const timeout = monitoringRules.timeoutMs / 1000;

  return `# Tarefa: implementar o endpoint de saúde para o Monitoramento da VR Gestão

Sistema: ${name}
Endereço que será monitorado: ${health}

## Objetivo
O Monitoramento da VR Gestão consulta este endpoint periodicamente para saber se o sistema está no ar e se as dependências críticas (banco de dados, cache, filas, serviços externos) estão respondendo. Implemente o endpoint exatamente no contrato abaixo: o monitor lê o JSON, não só o código HTTP.

## Contrato
- Método: GET (aceite também HEAD respondendo só o código HTTP).
- Caminho: /api/health (se o sistema já usa outro caminho, mantenha o contrato e informe o endereço final).
- Sem login, sem cookies e sem sessão: o endpoint precisa responder mesmo com o restante do sistema com problemas. Libere a rota em middlewares de autenticação, redirecionamento de idioma e rate limit.
- O monitor envia "User-Agent: VR-Gestao-Monitor/1.0" e "Accept: application/json", e espera no máximo ${timeout} segundos.
- Cabeçalhos da resposta: "Content-Type: application/json" e "Cache-Control: no-store".
- Código HTTP: 200 quando o status geral for "ok" ou "degraded"; 503 quando for "down".

## Corpo da resposta
{
  "status": "ok",
  "service": "${name}",
  "version": "1.4.2",
  "environment": "production",
  "uptimeSeconds": 86400,
  "timestamp": "2026-10-20T12:00:00.000Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 12, "critical": true },
    "cache": { "status": "ok", "latencyMs": 3, "critical": false },
    "email": { "status": "degraded", "latencyMs": 2140, "critical": false, "message": "SMTP lento" }
  }
}

- status: "ok", "degraded" ou "down" (geral).
- version: versão publicada (package.json, tag git ou SHA curto do deploy).
- checks: uma entrada por dependência, com status, latencyMs (número inteiro) e critical. "message" é opcional, curta e genérica.

## Lógica
1. Rode todas as verificações em paralelo (Promise.all / asyncio.gather), cada uma com timeout próprio de 2 segundos. Timeout conta como "down" daquela dependência.
2. Cada verificação deve ser a mais leve possível:
   - Banco de dados: uma consulta trivial (SELECT 1). Não conte linhas nem leia tabelas grandes.
   - Cache/Redis: PING.
   - Fila: verificar a conexão (e, se possível, se o tamanho da fila está abaixo de um limite).
   - Serviços externos (pagamento, e-mail, storage): só se tiverem um endpoint de status barato; sem isso, deixe de fora.
   - Disco: opcional, "degraded" acima de 90% de uso.
3. Status de cada verificação: "ok"; "degraded" se respondeu, mas acima de 1000 ms; "down" se falhou ou estourou o timeout.
4. Status geral:
   - "down" se QUALQUER verificação crítica (critical: true) estiver "down". O banco de dados principal é sempre crítico.
   - "degraded" se alguma verificação não crítica estiver "down", ou qualquer uma estiver "degraded".
   - "ok" nos demais casos.
5. A resposta completa deve sair em menos de ${slow / 1000} segundos. Acima disso o monitor marca o sistema como degradado, mesmo com tudo "ok".
6. Não use cache de resultado por mais de 10 segundos (se usar, deixe claro no campo "message").

## Segurança
- Nunca exponha segredos, strings de conexão, nomes de tabelas, stack traces, e-mails, IPs internos nem dados de clientes. Mensagens de erro devem ser genéricas ("timeout", "falha de conexão").
- O endpoint é público: não aceite parâmetros que mudem o comportamento nem execute nada além das verificações.
- Não registre cada chamada como log de informação (gera ruído); registre só quando o status mudar ou houver falha.

## Exemplo: Next.js (App Router) com Prisma
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const startedAt = Date.now();

type Check = { status: "ok" | "degraded" | "down"; latencyMs: number; critical: boolean; message?: string };

async function timed(critical: boolean, run: () => Promise<unknown>): Promise<Check> {
  const start = Date.now();
  try {
    await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))]);
    const latencyMs = Date.now() - start;
    return { status: latencyMs > 1000 ? "degraded" : "ok", latencyMs, critical };
  } catch (error) {
    return { status: "down", latencyMs: Date.now() - start, critical, message: error instanceof Error && error.message === "timeout" ? "timeout" : "falha de conexão" };
  }
}

export async function GET() {
  const checks = {
    database: await timed(true, () => prisma.$queryRaw\`SELECT 1\`),
    // cache: await timed(false, () => redis.ping()),
  };
  const values = Object.values(checks);
  const status = values.some((check) => check.critical && check.status === "down") ? "down"
    : values.some((check) => check.status !== "ok") ? "degraded" : "ok";
  return NextResponse.json({
    status,
    service: "${name}",
    version: process.env.APP_VERSION ?? process.env.npm_package_version ?? "desconhecida",
    environment: process.env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  }, { status: status === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

(Para várias verificações, use Promise.all em vez de await em sequência.)

## Exemplo: Express
app.get("/api/health", async (req, res) => {
  const checks = { database: await timed(true, () => pool.query("SELECT 1")) };
  const values = Object.values(checks);
  const status = values.some((c) => c.critical && c.status === "down") ? "down" : values.some((c) => c.status !== "ok") ? "degraded" : "ok";
  res.set("Cache-Control", "no-store").status(status === "down" ? 503 : 200).json({ status, service: "${name}", version: process.env.APP_VERSION, environment: process.env.NODE_ENV, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString(), checks });
});

## Como testar antes de entregar
1. curl -i ${health}
   Deve responder 200, Content-Type application/json e o corpo no formato acima, em menos de ${slow / 1000} s.
2. Desligue ou bloqueie o banco de dados e repita: deve responder 503 com "status": "down" e "database": { "status": "down" }.
3. Confirme que a rota não exige login (teste em aba anônima) e que nenhum segredo aparece no corpo.

## Entrega
Informe o endereço final do endpoint e a versão publicada. No VR Gestão, o endereço vai em Monitoramento > sistema > "Endpoint de saúde"; depois use VERIFICAR para confirmar o status "Operacional".
`;
}

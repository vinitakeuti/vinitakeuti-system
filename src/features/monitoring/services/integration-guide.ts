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

## Como implementar (qualquer linguagem ou framework)
Use a forma idiomática da linguagem e do framework do projeto (rota/controlador HTTP, cliente do banco já existente, configuração já usada para variáveis de ambiente). Não adicione dependências novas só para isso. A lógica, em pseudocódigo:

  ao iniciar o processo: guardar o horário de início (para uptimeSeconds)

  função verificar(nome, crítica, tarefa):
    início = agora
    tentar executar tarefa com limite de 2 segundos
      latência = agora - início
      retornar { status: (latência > 1000 ? "degraded" : "ok"), latencyMs: latência, critical: crítica }
    se falhar ou estourar o limite:
      retornar { status: "down", latencyMs: agora - início, critical: crítica, message: "timeout" ou "falha de conexão" }

  rota GET /api/health:
    checks = executar EM PARALELO:
      database = verificar("database", crítica = sim, "SELECT 1" no banco principal)
      ... uma entrada para cada dependência real do sistema (cache, fila, storage, serviços externos)
    status geral =
      "down"     se alguma verificação crítica estiver "down"
      "degraded" se alguma outra não estiver "ok"
      "ok"       nos demais casos
    responder JSON no formato acima, com Cache-Control: no-store
      e código HTTP 503 se o status geral for "down", senão 200

  rota HEAD /api/health: mesmo cálculo, só o código HTTP, sem corpo

Antes de escrever o código, levante quais dependências o sistema realmente usa (banco, cache, fila, e-mail, armazenamento de arquivos, APIs de terceiros) e decida quais são críticas: o sistema deixa de funcionar sem ela? Então é crítica.
Use a versão publicada que o projeto já tiver (variável de ambiente do deploy, arquivo de versão, tag ou SHA do commit). Se não houver nenhuma, use "desconhecida".

## Como testar antes de entregar
1. curl -i ${health}
   Deve responder 200, Content-Type application/json e o corpo no formato acima, em menos de ${slow / 1000} s.
2. Desligue ou bloqueie o banco de dados e repita: deve responder 503 com "status": "down" e "database": { "status": "down" }.
3. Confirme que a rota não exige login (teste em aba anônima) e que nenhum segredo aparece no corpo.

## Entrega
Informe o endereço final do endpoint e a versão publicada. No VR Gestão, o endereço vai em Monitoramento > sistema > "Endpoint de saúde"; depois use VERIFICAR para confirmar o status "Operacional".
`;
}

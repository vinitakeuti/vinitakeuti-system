export const monitoringRules = {
  intervalMinutes: 5,
  timeoutMs: 10_000,
  /** Acima disso, uma resposta saudável conta como degradada. */
  slowResponseMs: 3_000,
  alertAfterFailures: 2,
  securityPatterns: ["unauthorized", "brute force", "sql injection", "malware", "forbidden"],
} as const;

// O worker agendado será conectado no EasyPanel na próxima etapa. Esta base
// mantém as regras centralizadas para os monitores HTTP, logs e segurança.

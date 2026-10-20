import { CopyTextButton } from "@/components/copy-text-button";
import { monitoringIntegrationGuide } from "@/features/monitoring/services/integration-guide";

/**
 * Guia para outra IA implementar o endpoint de saúde num sistema de cliente, no formato que o monitor entende.
 * Fechado por padrão; com sistema informado, o texto já vem com o nome e o endereço dele.
 */
export function MonitoringGuide({ systemName, siteUrl, healthUrl, open = false }: { systemName?: string | null; siteUrl?: string | null; healthUrl?: string | null; open?: boolean }) {
  const text = monitoringIntegrationGuide({ systemName, siteUrl, healthUrl });
  return <details className="monitoring-guide" open={open}>
    <summary><span><b>GUIA PARA O ENDPOINT DE SAÚDE</b><small>Instruções para outra IA implementar, no sistema do cliente, o endpoint que este monitoramento entende.</small></span><strong>ABRIR</strong></summary>
    <div className="monitoring-guide-body">
      <div className="monitoring-guide-actions"><p>Copie e cole na IA que está desenvolvendo o sistema{systemName ? ` ${systemName}` : ""}. O texto explica o formato da resposta, a lógica das verificações, a segurança e como testar.</p><CopyTextButton text={text} label="COPIAR GUIA" className="primary-action" /></div>
      <pre>{text}</pre>
    </div>
  </details>;
}

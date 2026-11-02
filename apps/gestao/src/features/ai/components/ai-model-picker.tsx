"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiModelInfo } from "@/lib/integrations/ai/types";
import { listAiModelsAction } from "@/features/ai/services/ai-actions";

/**
 * Provedor, chave e o modelo de cada tarefa. Com a chave, BUSCAR MODELOS lista os modelos que ela libera (só os de
 * conversa; no OpenRouter, só os que usam ferramentas). Escolha a tarefa e clique no modelo da lista: Gestão é
 * obrigatória; Atendimento, Documentos e Orçamentos usam o da Gestão quando ficam vazios. Se o serviço não listar,
 * os modelos podem ser digitados. A chave digitada só é usada na consulta; é gravada ao salvar o formulário.
 */

type ProviderOption = { id: string; label: string; keyHint: string; modelHint: string };
type Task = "gestao" | "attendance" | "document" | "quote";
type Price = { input: string; output: string };

export const TASKS: Array<{ id: Task; label: string; detail: string }> = [
  { id: "gestao", label: "Gestão", detail: "Sua conversa no Assistente e no seu WhatsApp. Obrigatório." },
  { id: "attendance", label: "Atendimento", detail: "Site, WhatsApp de clientes e área do cliente." },
  { id: "document", label: "Documentos e contratos", detail: "Criar e revisar contratos, cessões, memoriais e documentos." },
  { id: "quote", label: "Orçamentos", detail: "Montar e alterar orçamentos com os serviços do catálogo." },
];

const usd = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thousands = new Intl.NumberFormat("pt-BR");

function modelMeta(model: AiModelInfo) {
  return [
    model.price ? (model.price.input === 0 && model.price.output === 0 ? "gratuito" : `US$ ${usd.format(model.price.input)} / ${usd.format(model.price.output)} por 1M tokens`) : null,
    model.contextLength ? `${thousands.format(Math.round(model.contextLength / 1000))} mil de contexto` : null,
    model.tools ? "usa ferramentas" : null,
  ].filter(Boolean).join(" · ");
}

const priceText = (dollars: number) => String(Math.round(dollars * 10_000) / 10_000).replace(".", ",");

export function AiModelPicker({ providers, initial }: { providers: ProviderOption[]; initial: { provider: string; baseUrl: string; keyHint: string | null; connected: boolean; usdBrl: string; models: Record<Task, string>; prices: Record<Task, Price> } }) {
  const [provider, setProvider] = useState(initial.provider);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [chosen, setChosen] = useState<Record<Task, string>>(initial.models);
  const [prices, setPrices] = useState<Record<Task, Price>>(initial.prices);
  const [task, setTask] = useState<Task>("gestao");
  const [models, setModels] = useState<AiModelInfo[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [usdBrl, setUsdBrl] = useState(initial.usdBrl);
  const loadedFor = useRef<string | null>(null);

  const option = providers.find((item) => item.id === provider) ?? providers[0];
  const savedKeyUsable = Boolean(initial.keyHint) && provider === initial.provider;
  const effective = (id: Task) => chosen[id] || chosen.gestao;

  /** Escolher um modelo para a tarefa ativa; com preço na lista (OpenRouter), o preço da tarefa é preenchido. */
  const choose = (item: AiModelInfo) => {
    setChosen((current) => ({ ...current, [task]: item.id }));
    if (item.price) setPrices((current) => ({ ...current, [task]: { input: priceText(item.price!.input), output: priceText(item.price!.output) } }));
  };

  const load = useCallback(async () => {
    const signature = `${provider}|${baseUrl}|${apiKey}`;
    loadedFor.current = signature;
    setLoading(true);
    setError(null);
    const result = await listAiModelsAction({ provider, baseUrl: provider === "custom" ? baseUrl : "", apiKey });
    if (loadedFor.current !== signature) return;
    setLoading(false);
    if (!result.ok) { setModels(null); setError(result.error); return; }
    setModels(result.models);
    setManual(false);
    setQuery("");
  }, [apiKey, baseUrl, provider]);

  // Já conectada: lista os modelos da chave salva ao abrir.
  useEffect(() => {
    if (initial.connected && initial.keyHint) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeProvider = (value: string) => {
    // Descarta uma busca de modelos ainda em andamento (era do provedor anterior).
    loadedFor.current = null;
    setLoading(false);
    setProvider(value);
    setModels(null);
    setError(null);
    setChosen(value === initial.provider ? initial.models : { gestao: "", attendance: "", document: "", quote: "" });
    setManual(false);
  };

  const filtered = useMemo(() => {
    if (!models) return [];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return terms.length ? models.filter((item) => terms.every((term) => `${item.label} ${item.id}`.toLowerCase().includes(term))) : models;
  }, [models, query]);

  const canLoad = !loading && (apiKey.trim().length >= 8 || savedKeyUsable) && (provider !== "custom" || baseUrl.trim().length > 0);
  const labelOf = (id: string) => models?.find((item) => item.id === id)?.label ?? id;
  const showList = Boolean(models) && !manual;
  const activeModel = chosen[task];
  // Uma linha de preço por modelo diferente em uso (a primeira tarefa que o usa guarda o preço).
  const priceRows = TASKS.filter((item, index) => TASKS.findIndex((other) => effective(other.id) === effective(item.id)) === index && effective(item.id));

  return <div className="settings-form-wide ai-model-picker">
    <div className="ai-model-row">
      <label>PROVEDOR<select name="provider" value={provider} onChange={(event) => changeProvider(event.target.value)} className="ai-select">{providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>{initial.keyHint && provider === initial.provider ? "TROCAR CHAVE DE API" : "CHAVE DE API"}<input name="apiKey" type="password" autoComplete="off" spellCheck={false} maxLength={400} value={apiKey} onChange={(event) => setApiKey(event.target.value)} onBlur={() => { if (apiKey.trim().length >= 20 && loadedFor.current !== `${provider}|${baseUrl}|${apiKey}`) void load(); }} placeholder={savedKeyUsable ? `…${initial.keyHint} (em branco mantém a atual)` : option.keyHint} /></label>
    </div>
    {provider === "custom" ? <label>ENDEREÇO DA API<input name="baseUrl" type="url" maxLength={300} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.groq.com/openai/v1 ou http://localhost:11434/v1 (Ollama)" spellCheck={false} /></label> : <input type="hidden" name="baseUrl" value="" />}

    <div className="ai-model-field">
      <div className="ai-model-head">
        <span>MODELO DE CADA TAREFA</span>
        <button type="button" className="secondary-action" onClick={() => void load()} disabled={!canLoad}>{loading ? "BUSCANDO…" : models ? "ATUALIZAR LISTA" : "BUSCAR MODELOS"}</button>
      </div>
      {TASKS.map((item) => <input key={item.id} type="hidden" name={`model_${item.id}`} value={chosen[item.id]} />)}
      <div className="ai-tasks" role="tablist" aria-label="Tarefa">
        {TASKS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={task === item.id} className={task === item.id ? "is-active" : undefined} onClick={() => setTask(item.id)}>
          <small>{item.label.toUpperCase()}</small>
          <b>{chosen[item.id] ? labelOf(chosen[item.id]) : item.id === "gestao" ? "Escolha um modelo" : "O mesmo da Gestão"}</b>
        </button>)}
      </div>
      <p className="ai-task-detail">{TASKS.find((item) => item.id === task)!.detail}{task !== "gestao" && activeModel ? <> <button type="button" className="text-link" onClick={() => setChosen((current) => ({ ...current, [task]: "" }))}>USAR O DA GESTÃO</button></> : null}</p>
      {showList ? <>
        <div className="ai-model-search">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={`Buscar entre ${models!.length} modelos`} aria-label="Buscar modelo" />
          <button type="button" className="text-link" onClick={() => setManual(true)}>DIGITAR OS NOMES</button>
        </div>
        <div className="ai-model-list" role="radiogroup" aria-label={`Modelo para ${TASKS.find((item) => item.id === task)!.label}`}>
          {filtered.length ? filtered.map((item) => <label key={item.id} className={item.id === activeModel ? "is-selected" : ""}>
            <input type="radio" name={`choice_${task}`} value={item.id} checked={item.id === activeModel} onChange={() => choose(item)} />
            <span><b>{item.label}</b><code>{item.id}</code>{modelMeta(item) ? <small>{modelMeta(item)}</small> : null}</span>
          </label>) : <p>Nenhum modelo encontrado para “{query}”.</p>}
        </div>
      </> : <div className="ai-model-manual-grid">
        {TASKS.map((item) => <label key={item.id}>{item.label.toUpperCase()}<input value={chosen[item.id]} onChange={(event) => setChosen((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={120} placeholder={item.id === "gestao" ? (models ? "Nome exato do modelo" : `Busque os modelos com a chave ou digite: ${option.modelHint}`) : "Vazio = o mesmo da Gestão"} spellCheck={false} autoComplete="off" /></label>)}
        {models ? <button type="button" className="text-link" onClick={() => setManual(false)}>VOLTAR PARA A LISTA</button> : null}
      </div>}
      {error ? <p className="ai-model-error" role="alert">{error}</p> : null}
    </div>

    <div className="ai-price">
      <span className="ai-price-title">CUSTO POR MODELO · US$ POR 1M TOKENS</span>
      <div className="ai-price-table">
        {priceRows.map((item) => <div key={item.id} className="ai-price-line">
          <span><b>{labelOf(effective(item.id))}</b><small>{TASKS.filter((other) => effective(other.id) === effective(item.id)).map((other) => other.label).join(" · ")}</small></span>
          <label>ENTRADA<input name={`price_${item.id}_input`} inputMode="decimal" value={prices[item.id]?.input ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: { ...current[item.id], input: event.target.value } }))} placeholder="ex.: 3,00" maxLength={12} /></label>
          <label>SAÍDA<input name={`price_${item.id}_output`} inputMode="decimal" value={prices[item.id]?.output ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: { ...current[item.id], output: event.target.value } }))} placeholder="ex.: 15,00" maxLength={12} /></label>
        </div>)}
      </div>
      <label className="ai-price-rate">COTAÇÃO DO DÓLAR · R$<input name="usdBrl" inputMode="decimal" value={usdBrl} onChange={(event) => setUsdBrl(event.target.value)} placeholder="ex.: 5,50" maxLength={8} /></label>
      <small>{provider === "openrouter" ? "O OpenRouter informa o custo real de cada resposta; os preços acima servem de referência." : "Use a tabela de preços do provedor para cada modelo. Sem preço, a atividade mostra só os tokens."} Com a cotação, o custo também aparece em reais.</small>
    </div>
  </div>;
}

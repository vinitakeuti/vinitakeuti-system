"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiModelInfo } from "@/lib/integrations/ai/types";
import { listAiModelsAction } from "@/features/ai/services/ai-actions";

/**
 * Provedor, chave e modelo da IA. Com a chave, BUSCAR MODELOS lista os modelos que ela libera (só os de conversa;
 * no OpenRouter, só os que usam ferramentas) para escolher na lista, com busca. Se o serviço não listar, o modelo
 * pode ser digitado. A chave digitada só é usada na consulta; é gravada ao salvar o formulário.
 */

type ProviderOption = { id: string; label: string; keyHint: string; modelHint: string };

const usd = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thousands = new Intl.NumberFormat("pt-BR");

function modelMeta(model: AiModelInfo) {
  return [
    model.price ? (model.price.input === 0 && model.price.output === 0 ? "gratuito" : `US$ ${usd.format(model.price.input)} / ${usd.format(model.price.output)} por 1M tokens`) : null,
    model.contextLength ? `${thousands.format(Math.round(model.contextLength / 1000))} mil de contexto` : null,
    model.tools ? "usa ferramentas" : null,
  ].filter(Boolean).join(" · ");
}

export function AiModelPicker({ providers, initial }: { providers: ProviderOption[]; initial: { provider: string; model: string; baseUrl: string; keyHint: string | null; connected: boolean } }) {
  const [provider, setProvider] = useState(initial.provider);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [models, setModels] = useState<AiModelInfo[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const option = providers.find((item) => item.id === provider) ?? providers[0];
  const savedKeyUsable = Boolean(initial.keyHint) && provider === initial.provider;

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
    setProvider(value);
    setModels(null);
    setError(null);
    setModel(value === initial.provider ? initial.model : "");
    setManual(false);
  };

  const filtered = useMemo(() => {
    if (!models) return [];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return terms.length ? models.filter((item) => terms.every((term) => `${item.label} ${item.id}`.toLowerCase().includes(term))) : models;
  }, [models, query]);

  const canLoad = !loading && (apiKey.trim().length >= 8 || savedKeyUsable) && (provider !== "custom" || baseUrl.trim().length > 0);
  const selected = models?.find((item) => item.id === model) ?? null;
  const showList = Boolean(models) && !manual;

  return <div className="settings-form-wide ai-model-picker">
    <div className="ai-model-row">
      <label>PROVEDOR<select name="provider" value={provider} onChange={(event) => changeProvider(event.target.value)} className="ai-select">{providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>{initial.keyHint && provider === initial.provider ? "TROCAR CHAVE DE API" : "CHAVE DE API"}<input name="apiKey" type="password" autoComplete="off" spellCheck={false} maxLength={400} value={apiKey} onChange={(event) => setApiKey(event.target.value)} onBlur={() => { if (apiKey.trim().length >= 20 && loadedFor.current !== `${provider}|${baseUrl}|${apiKey}`) void load(); }} placeholder={savedKeyUsable ? `…${initial.keyHint} (em branco mantém a atual)` : option.keyHint} /></label>
    </div>
    {provider === "custom" ? <label>ENDEREÇO DA API<input name="baseUrl" type="url" maxLength={300} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.groq.com/openai/v1 ou http://localhost:11434/v1 (Ollama)" spellCheck={false} /></label> : <input type="hidden" name="baseUrl" value="" />}

    <div className="ai-model-field">
      <div className="ai-model-head">
        <span>MODELO</span>
        <button type="button" className="secondary-action" onClick={() => void load()} disabled={!canLoad}>{loading ? "BUSCANDO…" : models ? "ATUALIZAR LISTA" : "BUSCAR MODELOS"}</button>
      </div>
      <input type="hidden" name="model" value={model} />
      {showList ? <>
        <div className="ai-model-search">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={`Buscar entre ${models!.length} modelos`} aria-label="Buscar modelo" />
          <button type="button" className="text-link" onClick={() => setManual(true)}>DIGITAR O NOME</button>
        </div>
        <div className="ai-model-list" role="radiogroup" aria-label="Modelos disponíveis">
          {filtered.length ? filtered.map((item) => <label key={item.id} className={item.id === model ? "is-selected" : ""}>
            <input type="radio" name="modelChoice" value={item.id} checked={item.id === model} onChange={() => setModel(item.id)} />
            <span><b>{item.label}</b><code>{item.id}</code>{modelMeta(item) ? <small>{modelMeta(item)}</small> : null}</span>
          </label>) : <p>Nenhum modelo encontrado para “{query}”.</p>}
        </div>
        <p className="ai-model-selected">{model ? selected ? <>Selecionado: <b>{selected.label}</b></> : <>Selecionado: <code>{model}</code> (não aparece na lista desta chave)</> : "Escolha um modelo na lista."}</p>
      </> : <>
        <input className="ai-model-manual" value={model} onChange={(event) => setModel(event.target.value)} maxLength={120} placeholder={models ? "Nome exato do modelo" : `Busque os modelos com a chave ou digite: ${option.modelHint}`} spellCheck={false} autoComplete="off" aria-label="Nome do modelo" />
        {models ? <button type="button" className="text-link" onClick={() => setManual(false)}>VOLTAR PARA A LISTA</button> : null}
      </>}
      {error ? <p className="ai-model-error" role="alert">{error}</p> : null}
    </div>
  </div>;
}

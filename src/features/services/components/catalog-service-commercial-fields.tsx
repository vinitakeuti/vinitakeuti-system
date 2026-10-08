"use client";

import { useState } from "react";

type PricingMethod = "FIXED" | "HOURLY" | "DAILY" | "CUSTOM";
type BillingType = "ONE_TIME" | "RECURRING";

type Props = {
  defaultBillingType?: BillingType;
  defaultPricingMethod?: PricingMethod;
  defaultAmountCents?: number;
  defaultBillingCycle?: string | null;
};

const pricingContent: Record<PricingMethod, { label: string; title: string; description: string; fieldLabel?: string; fieldHint?: string }> = {
  FIXED: {
    label: "Valor fechado",
    title: "Cadastre um valor fechado de referência.",
    description: "Esse é o valor base do serviço. No orçamento, ele entra como valor unitário e pode ser ajustado somente para aquela proposta.",
    fieldLabel: "Valor fechado de referência (R$)",
    fieldHint: "Use o valor total habitual para uma unidade deste serviço.",
  },
  HOURLY: {
    label: "Por hora",
    title: "Cadastre somente a taxa de uma hora.",
    description: "A quantidade de horas não pertence ao catálogo. Em cada orçamento, você informa as horas previstas e o total é calculado: horas × taxa por hora.",
    fieldLabel: "Taxa por hora (R$)",
    fieldHint: "Ex.: R$ 120 por hora. As horas serão definidas na proposta.",
  },
  DAILY: {
    label: "Por dia",
    title: "Cadastre somente a taxa de um dia.",
    description: "A quantidade de dias é definida em cada orçamento. O total da proposta é calculado: dias previstos × taxa por dia.",
    fieldLabel: "Taxa por dia (R$)",
    fieldHint: "Ex.: R$ 800 por dia. Os dias serão definidos na proposta.",
  },
  CUSTOM: {
    label: "Definir no orçamento",
    title: "Não defina valor no catálogo.",
    description: "Use esta opção quando preço e esforço variam muito. Ao adicionar o serviço a um orçamento, você define valor, regra e quantidade diretamente na proposta.",
  },
};

export function CatalogServiceCommercialFields({
  defaultBillingType = "ONE_TIME",
  defaultPricingMethod = "FIXED",
  defaultAmountCents = 0,
  defaultBillingCycle = "MONTHLY",
}: Props) {
  const [billingType, setBillingType] = useState<BillingType>(defaultBillingType);
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(defaultPricingMethod);
  const [amount, setAmount] = useState((defaultAmountCents / 100).toFixed(2));
  const [billingCycle, setBillingCycle] = useState(defaultBillingCycle ?? "MONTHLY");
  const content = pricingContent[pricingMethod];

  return <section className="service-commercial-fields">
    <p className="eyebrow">CONFIGURAÇÃO COMERCIAL</p>
    <p className="service-commercial-intro">Defina como este serviço se comporta por padrão. As quantidades de horas ou dias são sempre informadas no orçamento.</p>
    <div className="form-grid">
      <label>Modelo de cobrança<select name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value as BillingType)}><option value="ONE_TIME">Avulso / por projeto</option><option value="RECURRING">Recorrente</option></select></label>
      <label>Cálculo padrão no orçamento<select name="pricingMethod" value={pricingMethod} onChange={(event) => setPricingMethod(event.target.value as PricingMethod)}><option value="FIXED">Valor fechado</option><option value="HOURLY">Por hora</option><option value="DAILY">Por dia</option><option value="CUSTOM">Definir no orçamento</option></select></label>
    </div>
    <div className={`service-pricing-guide service-pricing-guide-${pricingMethod.toLowerCase()}`}>
      <span>REGRA SELECIONADA</span><strong>{content.title}</strong><p>{content.description}</p>
    </div>
    <div className="form-grid service-commercial-values">
      {pricingMethod === "CUSTOM" ? <input type="hidden" name="defaultAmount" value="0" /> : <label>{content.fieldLabel}<input name="defaultAmount" type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} /><small>{content.fieldHint}</small></label>}
      {billingType === "RECURRING" ? <label>Ciclo de cobrança<select name="billingCycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="YEARLY">Anual</option></select><small>Define a periodicidade da assinatura atribuída ao cliente.</small></label> : <div className="service-commercial-quote-note"><span>NO ORÇAMENTO</span><p>{pricingMethod === "HOURLY" ? "Informe as horas previstas." : pricingMethod === "DAILY" ? "Informe os dias previstos." : pricingMethod === "CUSTOM" ? "Defina valor e quantidade para esta proposta." : "Confirme o valor fechado e a quantidade quando necessário."}</p></div>}
    </div>
  </section>;
}

"use client";

import { useState } from "react";

type RecurringService = { id: string; name: string; defaultAmountCents: number; billingCycle: string | null; category: { name: string } };

export function RecurringServiceFields({ services }: { services: RecurringService[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const selected = services.find((service) => service.id === serviceId) ?? services[0];
  const [amount, setAmount] = useState(selected ? String(selected.defaultAmountCents / 100) : "");
  const [billingCycle, setBillingCycle] = useState(selected?.billingCycle ?? "MONTHLY");

  function changeService(nextId: string) {
    const next = services.find((service) => service.id === nextId);
    setServiceId(nextId);
    if (next) {
      setAmount(String(next.defaultAmountCents / 100));
      setBillingCycle(next.billingCycle ?? "MONTHLY");
    }
  }

  return <div className="form-grid"><label className="form-wide">Serviço recorrente<select name="serviceId" value={serviceId} onChange={(event) => changeService(event.target.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.category.name} — {service.name}</option>)}</select></label><label>Valor cobrado (R$)<input name="amount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Ciclo de cobrança<select name="billingCycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="YEARLY">Anual</option></select></label><label className="form-wide">Próximo pagamento<input name="nextPaymentAt" type="date" /></label></div>;
}

"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
const cents = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(String(v ?? "0").replace(",", ".")) * 100));
const n = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(v)) || 0);
export async function savePricingProfile(f: FormData) { const data = { internalHourlyCostCents: cents(f.get("cost")), targetMarginBps: n(f.get("margin")) * 100, taxBps: n(f.get("tax")) * 100, riskReserveBps: n(f.get("risk")) * 100, weeklyCapacityHours: n(f.get("capacity")), minimumProjectCents: cents(f.get("minimum")) }; await prisma.pricingProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data }); revalidatePath("/orcamentos/parametros"); }

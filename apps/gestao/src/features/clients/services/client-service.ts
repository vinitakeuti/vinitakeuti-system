import { prisma } from "@/lib/prisma";
import { clientDocumentLabel, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/br-documents";

/**
 * Cadastro de clientes sem formulário (usado pela IA), com as mesmas regras da tela: nome obrigatório, CPF e CNPJ
 * opcionais e válidos. Na edição, só os campos informados mudam.
 */

export type ClientFields = { name?: string; company?: string | null; email?: string | null; phone?: string | null; cpf?: string | null; cnpj?: string | null; address?: string | null; city?: string | null; notes?: string | null };

const LIMITS = { name: 160, company: 160, email: 254, phone: 40, address: 500, city: 120, notes: 4_000 } as const;
const clean = (value: string | null | undefined, max: number) => value === undefined ? undefined : value?.trim().slice(0, max) || null;

function documents(fields: ClientFields, current: { cpf: string | null; cnpj: string | null } = { cpf: null, cnpj: null }) {
  const cpf = fields.cpf === undefined ? current.cpf : onlyDigits(fields.cpf ?? "") || null;
  const cnpj = fields.cnpj === undefined ? current.cnpj : onlyDigits(fields.cnpj ?? "") || null;
  if (cpf && !isValidCpf(cpf)) return { error: "CPF inválido. Confira os 11 dígitos." };
  if (cnpj && !isValidCnpj(cnpj)) return { error: "CNPJ inválido. Confira os 14 dígitos." };
  return { cpf, cnpj, document: clientDocumentLabel({ cpf, cnpj }) };
}

function textFields(fields: ClientFields) {
  return { company: clean(fields.company, LIMITS.company), email: clean(fields.email, LIMITS.email), phone: clean(fields.phone, LIMITS.phone), address: clean(fields.address, LIMITS.address), city: clean(fields.city, LIMITS.city), notes: clean(fields.notes, LIMITS.notes) };
}

/** Clientes com nome ou empresa parecidos, para não cadastrar o mesmo duas vezes. */
export async function findSimilarClients(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => word.length >= 3).slice(0, 4);
  if (!words.length) return [];
  return prisma.client.findMany({ where: { OR: words.flatMap((word) => [{ name: { contains: word, mode: "insensitive" as const } }, { company: { contains: word, mode: "insensitive" as const } }]) }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 8, select: { id: true, name: true, company: true, email: true } });
}

export async function createClientRecord(fields: ClientFields & { name: string }) {
  const name = fields.name.trim().slice(0, LIMITS.name);
  if (!name) return { ok: false as const, error: "Informe o nome do cliente." };
  const docs = documents(fields);
  if ("error" in docs) return { ok: false as const, error: docs.error! };
  const client = await prisma.client.create({ data: { name, ...textFields(fields), cpf: docs.cpf, cnpj: docs.cnpj, document: docs.document }, select: { id: true, name: true } });
  return { ok: true as const, client };
}

export async function updateClientRecord(id: string, fields: ClientFields) {
  const current = await prisma.client.findUnique({ where: { id: id.slice(0, 50) }, select: { id: true, cpf: true, cnpj: true } });
  if (!current) return { ok: false as const, error: "Cliente não encontrado." };
  if (fields.name !== undefined && !fields.name.trim()) return { ok: false as const, error: "O nome não pode ficar vazio." };
  const docs = documents(fields, current);
  if ("error" in docs) return { ok: false as const, error: docs.error! };
  const data = Object.fromEntries(Object.entries({ ...(fields.name !== undefined ? { name: fields.name.trim().slice(0, LIMITS.name) } : {}), ...textFields(fields) }).filter(([, value]) => value !== undefined));
  await prisma.client.update({ where: { id: current.id }, data: { ...data, cpf: docs.cpf, cnpj: docs.cnpj, document: docs.document } });
  return { ok: true as const, clientId: current.id };
}

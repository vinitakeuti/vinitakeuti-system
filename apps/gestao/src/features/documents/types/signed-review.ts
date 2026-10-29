/** Última via assinada enviada pelo cliente no portal (sem o arquivo). */
export const latestSignedCopy = {
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  take: 1,
  select: { id: true, createdAt: true, fileName: true, byteSize: true, reviewStatus: true, reviewedAt: true, rejectionReason: true },
};

export type SignedCopy = { id: string; createdAt: Date; fileName: string; byteSize: number; reviewStatus: "IN_REVIEW" | "APPROVED" | "REJECTED"; reviewedAt: Date | null; rejectionReason: string | null };

/**
 * Assinatura do cliente em um documento: rascunho ainda não vai para o portal; concluído sem via aguarda o cliente;
 * com via, segue a conferência manual (em conferência, assinado ou recusado).
 */
export type SignatureState = "draft" | "waiting" | "review" | "signed" | "rejected";

export function signatureState(completed: boolean, signed: Pick<SignedCopy, "reviewStatus"> | null): SignatureState {
  if (!completed) return "draft";
  if (!signed) return "waiting";
  return signed.reviewStatus === "APPROVED" ? "signed" : signed.reviewStatus === "REJECTED" ? "rejected" : "review";
}

/** Situação da via enviada, para listas da gestão. */
export const signedLabels: Record<SignedCopy["reviewStatus"], string> = { IN_REVIEW: "Via enviada, para conferir", APPROVED: "Assinado pelo cliente", REJECTED: "Via recusada" };

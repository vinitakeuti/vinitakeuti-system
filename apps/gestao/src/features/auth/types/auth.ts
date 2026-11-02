import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  /** Senha provisória: o portal pede a troca antes de qualquer outra página. */
  mustChangePassword: boolean;
};

export type AuthPortal = "management" | "client" | "landing";
export type SessionAudience = Exclude<AuthPortal, "landing">;

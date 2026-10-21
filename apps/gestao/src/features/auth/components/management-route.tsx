import { requireManagementUser } from "@/features/auth/services/auth-session";

export async function ManagementRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireManagementUser();
  return children;
}

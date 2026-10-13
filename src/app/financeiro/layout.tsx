import { ManagementRoute } from "@/features/auth/components/management-route";

export default function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ManagementRoute>{children}</ManagementRoute>;
}

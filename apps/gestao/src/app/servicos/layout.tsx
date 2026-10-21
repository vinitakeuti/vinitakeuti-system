import { ManagementRoute } from "@/features/auth/components/management-route";

export default function ServicesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ManagementRoute>{children}</ManagementRoute>;
}

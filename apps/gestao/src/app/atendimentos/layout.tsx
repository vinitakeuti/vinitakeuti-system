import { ManagementRoute } from "@/features/auth/components/management-route";

export default function AttendancesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ManagementRoute>{children}</ManagementRoute>;
}

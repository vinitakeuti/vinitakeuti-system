import { ManagementRoute } from "@/features/auth/components/management-route";

export default function ProjectsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ManagementRoute>{children}</ManagementRoute>;
}

import { Suspense, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar, type SessionUserView } from "@/components/layout/app-sidebar";
import { HeaderSkeleton, SidebarSkeleton } from "@/components/layout/skeletons";
import { requireSessionUser, type SessionUser } from "@/lib/auth/session";

function toView(user: SessionUser): SessionUserView {
  return { name: user.name, email: user.email, roles: user.roles };
}

async function SidebarData() {
  const user = await requireSessionUser();
  return <AppSidebar user={toView(user)} />;
}

async function HeaderData() {
  const user = await requireSessionUser();
  return <AppHeader user={toView(user)} />;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarData />
      </Suspense>
      <SidebarInset>
        <Suspense fallback={<HeaderSkeleton />}>
          <HeaderData />
        </Suspense>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

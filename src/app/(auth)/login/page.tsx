import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

async function RedirectIfAuthenticated() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return null;
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Masuk</h1>
        <p className="text-[13px] text-muted-foreground">
          Gunakan akun yang diberikan Administrator.
        </p>
      </div>
      <Suspense fallback={<LoginFormSkeleton />}>
        <RedirectIfAuthenticated />
        <LoginForm />
      </Suspense>
    </div>
  );
}

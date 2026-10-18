import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CircleCheck, Handshake, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { can, roleLabel } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };

const FOUNDATION_ITEMS = [
  "Autentikasi email + password (daftar publik dimatikan)",
  "RBAC 8 role dengan tabel roles dan user_roles",
  "Audit log terpusat untuk setiap mutasi penting",
  "Master data Buyer sebagai pola referensi modul",
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan operasional garmen Anda.</p>
      </div>

      <Suspense fallback={<WelcomeSkeleton />}>
        <WelcomeCard />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Fase 1 — Fondasi</CardTitle>
          <CardDescription>
            MVP dibangun bertahap: order-to-shipment lengkap sampai Fase 5 (Pengiriman &amp;
            Laporan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {FOUNDATION_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </CardContent>
    </Card>
  );
}

async function WelcomeCard() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selamat datang, {user.name}</CardTitle>
        <CardDescription>Anda masuk dengan role berikut.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {user.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {roleLabel(role)}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user.roles, "buyer.view") ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/buyers" />}
            >
              <Handshake data-icon="inline-start" />
              Kelola Buyer
            </Button>
          ) : null}
          {can(user.roles, "user.view") ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/settings/users" />}
            >
              <Users data-icon="inline-start" />
              Manajemen Pengguna
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

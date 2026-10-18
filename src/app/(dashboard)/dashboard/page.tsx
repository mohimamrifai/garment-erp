import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Handshake, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_CODES, can, roleLabel } from "@/lib/permissions";
import { listBuyers } from "@/modules/buyer/service";
import { listUsers } from "@/modules/user/service";

export const metadata: Metadata = { title: "Dashboard" };

const PIPELINE = [
  {
    code: "SO",
    name: "Sales Order",
    phase: "F2",
    description: "Order buyer, item, ukuran, dan tenggat kirim.",
  },
  {
    code: "PO",
    name: "Pembelian",
    phase: "F3",
    description: "Purchase order bahan dan aksesori ke supplier.",
  },
  {
    code: "RCV",
    name: "Penerimaan & Stok",
    phase: "F3",
    description: "Penerimaan barang, stok masuk/keluar, dan kartu stok.",
  },
  {
    code: "SPK",
    name: "Produksi & QC",
    phase: "F4",
    description: "Surat perintah kerja, progres produksi, dan quality control.",
  },
  {
    code: "SJ",
    name: "Pengiriman",
    phase: "F5",
    description: "Surat jalan dan serah terima barang ke buyer.",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground">Ringkasan operasional garmen Anda.</p>
      </header>

      <Suspense fallback={<SummarySkeleton />}>
        <SummarySection />
      </Suspense>

      <PipelineCard />
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4">
      <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span className="nums font-mono text-2xl font-semibold tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

async function SummarySection() {
  const user = await getSessionUser();
  if (!user) return null;

  const showBuyers = can(user.roles, "buyer.view");
  const showUsers = can(user.roles, "user.view");

  const buyerCount = showBuyers
    ? (await listBuyers({ status: "all", page: 1, pageSize: 1 })).total
    : null;
  const userCount = showUsers ? (await listUsers({ page: 1, pageSize: 1 })).total : null;

  const tiles = [
    buyerCount !== null
      ? { key: "buyers", label: "Buyer terdaftar", value: buyerCount, hint: "master data" }
      : null,
    userCount !== null
      ? { key: "users", label: "Pengguna sistem", value: userCount, hint: "akun & role" }
      : null,
    { key: "roles", label: "Role RBAC", value: ROLE_CODES.length, hint: "matriks izin terpusat" },
  ].filter((tile) => tile !== null);

  const gridCols =
    tiles.length >= 3 ? "sm:grid-cols-3" : tiles.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Selamat datang, {user.name}</CardTitle>
            <CardDescription>Anda masuk dengan role berikut.</CardDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showBuyers ? (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/buyers" />}>
                <Handshake data-icon="inline-start" />
                Kelola Buyer
              </Button>
            ) : null}
            {showUsers ? (
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
        </div>
      </CardHeader>
      <CardContent className={`grid gap-px bg-border p-0 ${gridCols}`}>
        {tiles.map((tile) => (
          <StatTile key={tile.key} label={tile.label} value={tile.value} hint={tile.hint} />
        ))}
      </CardContent>
    </Card>
  );
}

function SummarySkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function PipelineCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>Alur order-to-shipment</CardTitle>
        <CardDescription>
          Modul dibangun bertahap; setiap dokumen mengikuti alur pabrik dengan kode tetap.
        </CardDescription>
      </CardHeader>
      <div className="divide-y">
        {PIPELINE.map((step) => (
          <div key={step.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-14 shrink-0 rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 text-center font-mono text-[11px] tracking-wide text-foreground/80">
              {step.code}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{step.name}</span>
              <span className="text-xs text-muted-foreground">{step.description}</span>
            </div>
            <Badge variant="outline" className="font-mono">
              {step.phase}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

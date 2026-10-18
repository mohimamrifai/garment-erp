import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Handshake, ShoppingCart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_CODES, can, roleLabel } from "@/lib/permissions";
import { formatNumber } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { listBuyers } from "@/modules/buyer/service";
import { SoStatusBadge } from "@/modules/sales-order/components/so-status-badge";
import { getDashboardSoSummary } from "@/modules/sales-order/service";
import { listUsers } from "@/modules/user/service";

export const metadata: Metadata = { title: "Dashboard" };

type PipelineStep = {
  code: string;
  name: string;
  phase: string;
  description: string;
  /** Modul sudah tersedia di aplikasi (bukan placeholder). */
  available: boolean;
};

const PIPELINE: readonly PipelineStep[] = [
  {
    code: "SO",
    name: "Sales Order",
    phase: "F2",
    description: "Order buyer, item, ukuran, dan tenggat kirim.",
    available: true,
  },
  {
    code: "PO",
    name: "Pembelian",
    phase: "F3",
    description: "Purchase order bahan dan aksesori ke supplier.",
    available: false,
  },
  {
    code: "RCV",
    name: "Penerimaan & Stok",
    phase: "F3",
    description: "Penerimaan barang, stok masuk/keluar, dan kartu stok.",
    available: false,
  },
  {
    code: "SPK",
    name: "Produksi & QC",
    phase: "F4",
    description: "Surat perintah kerja, progres produksi, dan quality control.",
    available: false,
  },
  {
    code: "SJ",
    name: "Pengiriman",
    phase: "F5",
    description: "Surat jalan dan serah terima barang ke buyer.",
    available: false,
  },
];

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

      <Suspense fallback={<SalesSummarySkeleton />}>
        <SalesSummarySection />
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

function SalesSummarySkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Kartu sales order: jumlah aktif + daftar tenggat terdekat (F2 task 2.9). */
async function SalesSummarySection() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "so.view")) return null;

  const summary = await getDashboardSoSummary();
  const today = getTodayDate();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Sales order</CardTitle>
            <CardDescription>
              Pesanan aktif dan tenggat dalam 7 hari ke depan (termasuk yang terlewat).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/sales" />}
          >
            <ShoppingCart data-icon="inline-start" />
            Buka Sales Order
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-3">
        <StatTile
          label="SO aktif"
          value={summary.activeCount}
          hint="belum selesai atau dibatalkan"
        />
        <StatTile
          label="Menunggu konfirmasi"
          value={summary.draftCount}
          hint="pesanan berstatus draf"
        />
        <StatTile
          label="Tenggat ≤ 7 hari"
          value={summary.dueSoonCount}
          hint={`${summary.overdueCount} lewat tenggat`}
        />
      </CardContent>
      <div className="divide-y border-t">
        {summary.dueSoon.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Tidak ada pesanan aktif yang mendekati tenggat.
          </p>
        ) : (
          summary.dueSoon.map((order) => {
            const overdue = order.dueDate < today;
            return (
              <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  href={`/sales/${order.id}`}
                  className="nums w-36 shrink-0 rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {order.number}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{order.buyerName}</span>
                  <span className="nums font-mono text-[11px] text-muted-foreground">
                    {formatNumber(order.totalQuantity)} pcs
                  </span>
                </div>
                <span
                  className={
                    overdue
                      ? "nums font-mono text-xs text-destructive"
                      : "nums font-mono text-xs text-muted-foreground"
                  }
                >
                  {formatDateId(order.dueDate)}
                  {overdue ? " · lewat" : ""}
                </span>
                <SoStatusBadge status={order.status} />
              </div>
            );
          })
        )}
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
            <Badge
              variant="outline"
              className={
                step.available
                  ? "border-success/30 bg-success/10 font-mono text-success"
                  : "font-mono"
              }
            >
              {step.available ? `${step.phase} · aktif` : step.phase}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

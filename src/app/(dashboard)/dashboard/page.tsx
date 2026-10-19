import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Factory,
  Handshake,
  PackageSearch,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_CODES, can, roleLabel } from "@/lib/permissions";
import { formatNumber, formatQty } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { listBuyers } from "@/modules/buyer/service";
import {
  DASHBOARD_PERIOD_OPTIONS,
  getDashboardProductionPeriod,
  resolveDashboardDays,
} from "@/modules/dashboard/service";
import { OutputChart } from "@/modules/dashboard/components/output-chart";
import { getDashboardFinishedGoodsSummary } from "@/modules/finished-goods/service";
import { getDashboardInventorySummary } from "@/modules/inventory/service";
import { PoStatusBadge } from "@/modules/purchasing/components/purchasing-badges";
import { getDashboardPurchasingSummary } from "@/modules/purchasing/service";
import { SpkStatusBadge } from "@/modules/production/components/production-badges";
import { getDashboardProductionSummary } from "@/modules/production/service";
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
    available: true,
  },
  {
    code: "RCV",
    name: "Penerimaan & Stok",
    phase: "F3",
    description: "Penerimaan barang, stok masuk/keluar, dan kartu stok.",
    available: true,
  },
  {
    code: "SPK",
    name: "Produksi & QC",
    phase: "F4",
    description: "Surat perintah kerja, progres produksi, dan quality control.",
    available: true,
  },
  {
    code: "SJ",
    name: "Pengiriman",
    phase: "F5",
    description: "Surat jalan, alokasi barang jadi, dan serah terima ke buyer.",
    available: true,
  },
];

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function DashboardPage({ searchParams }: DashboardPageProps) {
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

      <Suspense fallback={<SalesSummarySkeleton />}>
        <PurchasingSummarySection />
      </Suspense>

      <Suspense fallback={<SalesSummarySkeleton />}>
        <InventorySummarySection />
      </Suspense>

      <Suspense fallback={<SalesSummarySkeleton />}>
        <ProductionSummarySection />
      </Suspense>

      <Suspense fallback={<SalesSummarySkeleton />}>
        <FulfillmentSummarySection searchParams={searchParams} />
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

/** Kartu pembelian: PO terbuka + estimasi kedatangan terdekat (F3 task 3.10). */
async function PurchasingSummarySection() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "po.view")) return null;

  const summary = await getDashboardPurchasingSummary();
  const today = getTodayDate();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Pembelian</CardTitle>
            <CardDescription>
              Purchase order berjalan dan estimasi kedatangan dalam 7 hari ke depan.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/purchasing" />}
          >
            <ClipboardList data-icon="inline-start" />
            Buka Pembelian
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-3">
        <StatTile label="PO terbuka" value={summary.openCount} hint="dipesan atau sebagian diterima" />
        <StatTile label="PO draf" value={summary.draftCount} hint="belum dipesan ke supplier" />
        <StatTile
          label="Penerimaan draf"
          value={summary.draftReceiptCount}
          hint="menunggu diposting ke stok"
        />
      </CardContent>
      <div className="divide-y border-t">
        {summary.nearest.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Tidak ada purchase order dengan estimasi kedatangan dekat.
          </p>
        ) : (
          summary.nearest.map((order) => {
            const overdue = order.expectedDate !== null && order.expectedDate < today;
            return (
              <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  href={`/purchasing/${order.id}`}
                  className="nums w-36 shrink-0 rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {order.number}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{order.supplierName}</span>
                  <span className="nums font-mono text-[11px] text-muted-foreground">
                    sisa {formatQty(order.remainingQuantity)}
                  </span>
                </div>
                <span
                  className={
                    overdue
                      ? "nums font-mono text-xs text-destructive"
                      : "nums font-mono text-xs text-muted-foreground"
                  }
                >
                  {order.expectedDate ? formatDateId(order.expectedDate) : "—"}
                  {overdue ? " · lewat" : ""}
                </span>
                <PoStatusBadge status={order.status} />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

/** Kartu stok: material di bawah minimum + jumlah material bersaldo (F3 task 3.10). */
async function InventorySummarySection() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "inventory.view")) return null;

  const summary = await getDashboardInventorySummary();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Stok gudang</CardTitle>
            <CardDescription>
              Kondisi saldo material aktif dibandingkan stok minimum yang ditetapkan.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/inventory" />}
          >
            <Boxes data-icon="inline-start" />
            Buka Inventori
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2">
        <StatTile
          label="Di bawah stok minimum"
          value={summary.lowStockCount}
          hint="material aktif yang perlu restock"
        />
        <StatTile
          label="Material bersaldo"
          value={summary.stockedMaterialCount}
          hint="material dengan stok tercatat di gudang"
        />
      </CardContent>
      {summary.lowStockCount > 0 ? (
        <div className="flex items-center gap-2 border-t bg-warning/5 px-4 py-3 text-[13px] text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            {summary.lowStockCount} material perlu restock.{" "}
            <Link
              href="/inventory?low=1"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Lihat daftar
            </Link>
          </span>
        </div>
      ) : null}
    </Card>
  );
}

/** Kartu produksi: SPK aktif, inspeksi menunggu, dan rework (F4 task 4.8). */
async function ProductionSummarySection() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "production.view")) return null;

  const summary = await getDashboardProductionSummary();
  const today = getTodayDate();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Produksi & QC</CardTitle>
            <CardDescription>
              SPK berjalan dan tenggat produksi terdekat, beserta kondisi inspeksi QC.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can(user.roles, "qc.view") ? (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/qc" />}>
                <ClipboardCheck data-icon="inline-start" />
                Buka QC
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/production" />}
            >
              <Factory data-icon="inline-start" />
              Buka Produksi
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-3">
        <StatTile label="SPK aktif" value={summary.activeCount} hint="terbuka atau berjalan" />
        <StatTile
          label="QC menunggu keputusan"
          value={summary.pendingQcCount}
          hint="inspeksi berstatus menunggu"
        />
        <StatTile
          label="Rework tercatat"
          value={summary.reworkCount}
          hint={`${summary.completedThisMonthCount} SPK selesai bulan ini`}
        />
      </CardContent>
      <div className="divide-y border-t">
        {summary.nearest.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada SPK aktif saat ini.</p>
        ) : (
          summary.nearest.map((order) => {
            const overdue = order.plannedEndDate < today;
            return (
              <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  href={`/production/${order.id}`}
                  className="nums w-36 shrink-0 rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {order.number}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{order.productName}</span>
                  <span className="nums font-mono text-[11px] text-muted-foreground">
                    {order.variantSku} · {formatQty(order.outputQuantity)} /{" "}
                    {formatQty(order.plannedQuantity)} pcs
                  </span>
                </div>
                <span
                  className={
                    overdue
                      ? "nums font-mono text-xs text-destructive"
                      : "nums font-mono text-xs text-muted-foreground"
                  }
                >
                  {formatDateId(order.plannedEndDate)}
                  {overdue ? " · lewat" : ""}
                </span>
                <SpkStatusBadge status={order.status} />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

async function FulfillmentSummarySection({ searchParams }: DashboardPageProps) {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "fg.view")) return null;

  const params = await searchParams;
  const days = resolveDashboardDays(
    typeof params.period === "string" ? params.period : undefined,
  );
  const [finishedGoods, period] = await Promise.all([
    getDashboardFinishedGoodsSummary(),
    getDashboardProductionPeriod(days),
  ]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Barang Jadi & Pengiriman</CardTitle>
            <CardDescription>
              Stok siap kirim, output packing, defect rate QC, dan pengiriman bulan berjalan.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border p-0.5">
              {DASHBOARD_PERIOD_OPTIONS.map((option) => (
                <Link
                  key={option}
                  href={`/dashboard?period=${option}`}
                  className={
                    days === option
                      ? "rounded-md bg-brand px-2 py-1 font-mono text-[11px] text-brand-foreground"
                      : "rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  }
                >
                  {option} hari
                </Link>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/finished-goods" />}
            >
              <PackageSearch data-icon="inline-start" />
              Barang Jadi
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/shipping" />}
            >
              <Truck data-icon="inline-start" />
              Pengiriman
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Stok FG tersedia"
            value={finishedGoods.totalAvailable}
            hint={`${formatNumber(finishedGoods.totalOnHand)} fisik · ${formatNumber(finishedGoods.totalReserved)} dialokasikan`}
          />
          <StatTile
            label="Output packing"
            value={period.outputQuantity}
            hint={`${days} hari terakhir`}
          />
          <StatTile
            label="Defect rate QC"
            value={Number(period.defectRate.toFixed(2))}
            hint={`${formatNumber(period.inspectedQuantity)} unit diperiksa`}
          />
          <StatTile
            label="Dikirim bulan ini"
            value={finishedGoods.shippedQuantityThisMonth}
            hint={`${finishedGoods.shipmentsThisMonth} surat jalan diposting`}
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium">Output packing per hari</p>
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {formatDateId(period.from)} – {formatDateId(period.to)}
            </p>
          </div>
          <OutputChart data={period.daily} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Batang oranye: unit lolos packing. Batang abu: unit cacat tercatat pada semua tahap.
          </p>
        </div>
      </CardContent>
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

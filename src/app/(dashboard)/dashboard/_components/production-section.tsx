import Link from "next/link";
import { ClipboardCheck, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatQty } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { SpkStatusBadge } from "@/modules/production/components/production-badges";
import { getDashboardProductionSummary } from "@/modules/production/service";
import { StatTile } from "./stat-tile";

export async function ProductionSummarySection() {
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

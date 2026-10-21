import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatQty } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { PoStatusBadge } from "@/modules/purchasing/components/purchasing-badges";
import { getDashboardPurchasingSummary } from "@/modules/purchasing/service";
import { StatTile } from "./stat-tile";

export async function PurchasingSummarySection() {
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

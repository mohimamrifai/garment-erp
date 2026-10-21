import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatNumber } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { SoStatusBadge } from "@/modules/sales-order/components/so-status-badge";
import { getDashboardSoSummary } from "@/modules/sales-order/service";
import { StatTile } from "./stat-tile";

export async function SalesSummarySection() {
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

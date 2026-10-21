import Link from "next/link";
import { PackageSearch, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatNumber } from "@/lib/utils/currency";
import { formatDateId } from "@/lib/utils/dates";
import {
  DASHBOARD_PERIOD_OPTIONS,
  getDashboardProductionPeriod,
  resolveDashboardDays,
} from "@/modules/dashboard/service";
import { OutputChart } from "@/modules/dashboard/components/output-chart";
import { getDashboardFinishedGoodsSummary } from "@/modules/finished-goods/service";
import { StatTile } from "./stat-tile";

type FulfillmentSummarySectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function FulfillmentSummarySection({ searchParams }: FulfillmentSummarySectionProps) {
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

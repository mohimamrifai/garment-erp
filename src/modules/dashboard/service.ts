import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productionRecords, productionStages, qcInspections } from "@/lib/db/schema";
import { TIME_ZONE, getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { computeDefectRate } from "@/modules/reports/calc";

/**
 * Agregasi dashboard penuh (PRD FR-02, F5 task 5.5) — output produksi &
 * defect rate per periode. Query agregasi memakai indeks waktu tabel
 * `production_records.recorded_at` / `qc_inspections.inspected_at`.
 */

export const DASHBOARD_PERIOD_OPTIONS = [7, 30, 90] as const;

export function resolveDashboardDays(value?: string | number | null): number {
  const parsed = Number(value);
  return (DASHBOARD_PERIOD_OPTIONS as readonly number[]).includes(parsed) ? parsed : 30;
}

export type DashboardDailyPoint = {
  date: string;
  label: string;
  output: number;
  rejected: number;
};

export type DashboardProductionPeriod = {
  days: number;
  from: string;
  to: string;
  /** Output packing (barang jadi) pada periode. */
  outputQuantity: number;
  processedQuantity: number;
  rejectedQuantity: number;
  inspectedQuantity: number;
  qcRejectedQuantity: number;
  defectRate: number;
  daily: DashboardDailyPoint[];
};

export async function getDashboardProductionPeriod(
  days: number,
): Promise<DashboardProductionPeriod> {
  const to = getTodayDate();
  const from = getDateOffset(-(days - 1));
  const start = new Date(`${from}T00:00:00+07:00`);
  const endExclusive = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000);
  const inRange = and(
    gte(productionRecords.recordedAt, start),
    lt(productionRecords.recordedAt, endExclusive),
  );

  const [records] = await db
    .select({
      processed: sql<number>`coalesce(sum(${productionRecords.processedQuantity}), 0)::int`,
      rejected: sql<number>`coalesce(sum(${productionRecords.rejectedQuantity}), 0)::int`,
      output: sql<number>`coalesce(sum(case when ${productionStages.stageCode} = 'PACKING' then ${productionRecords.passedQuantity} else 0 end), 0)::int`,
    })
    .from(productionRecords)
    .innerJoin(productionStages, eq(productionRecords.productionStageId, productionStages.id))
    .where(inRange);

  const [qc] = await db
    .select({
      inspected: sql<number>`coalesce(sum(${qcInspections.inspectedQuantity}), 0)::int`,
      rejected: sql<number>`coalesce(sum(${qcInspections.rejectedQuantity}), 0)::int`,
    })
    .from(qcInspections)
    .where(
      and(
        gte(qcInspections.inspectedAt, start),
        lt(qcInspections.inspectedAt, endExclusive),
      ),
    );

  const dailyRows = await db
    .select({
      date: sql<string>`to_char(${productionRecords.recordedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`,
      output: sql<number>`coalesce(sum(case when ${productionStages.stageCode} = 'PACKING' then ${productionRecords.passedQuantity} else 0 end), 0)::int`,
      rejected: sql<number>`coalesce(sum(${productionRecords.rejectedQuantity}), 0)::int`,
    })
    .from(productionRecords)
    .innerJoin(productionStages, eq(productionRecords.productionStageId, productionStages.id))
    .where(inRange)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const dailyMap = new Map(dailyRows.map((row) => [row.date, row]));
  const labelFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  });
  const daily: DashboardDailyPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = getDateOffset(-offset);
    const row = dailyMap.get(date);
    daily.push({
      date,
      label: labelFormatter.format(new Date(`${date}T00:00:00+07:00`)),
      output: Number(row?.output ?? 0),
      rejected: Number(row?.rejected ?? 0),
    });
  }

  const inspectedQuantity = Number(qc?.inspected ?? 0);
  const qcRejectedQuantity = Number(qc?.rejected ?? 0);

  return {
    days,
    from,
    to,
    outputQuantity: Number(records?.output ?? 0),
    processedQuantity: Number(records?.processed ?? 0),
    rejectedQuantity: Number(records?.rejected ?? 0),
    inspectedQuantity,
    qcRejectedQuantity,
    defectRate: computeDefectRate(inspectedQuantity, qcRejectedQuantity),
    daily,
  };
}

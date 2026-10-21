import type { Metadata } from "next";
import { Suspense } from "react";
import { FulfillmentSummarySection } from "./_components/fulfillment-section";
import { InventorySummarySection } from "./_components/inventory-section";
import { ProductionSummarySection } from "./_components/production-section";
import { PurchasingSummarySection } from "./_components/purchasing-section";
import { SalesSummarySection } from "./_components/sales-section";
import { SectionSkeleton, SummarySkeleton } from "./_components/skeletons";
import { SummarySection } from "./_components/summary-section";

export const metadata: Metadata = { title: "Dashboard" };

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

      <Suspense fallback={<SectionSkeleton />}>
        <SalesSummarySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PurchasingSummarySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <InventorySummarySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ProductionSummarySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FulfillmentSummarySection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

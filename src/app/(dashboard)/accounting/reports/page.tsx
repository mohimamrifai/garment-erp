import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { listReportsForRoles } from "@/modules/reports/service";

export const metadata: Metadata = { title: "Laporan Keuangan" };

const FINANCE_SLUGS = new Set([
  "trial-balance",
  "income-statement",
  "balance-sheet",
  "general-ledger",
  "cash-flow",
  "ar-aging",
  "ap-aging",
  "payroll-summary",
]);

export default function AccountingReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Neraca saldo, laba rugi, neraca, buku besar, arus kas, umur piutang/utang, dan rekap payroll."
      />
      <Suspense fallback={<AccountingReportsSkeleton />}>
        <AccountingReportsSection />
      </Suspense>
    </div>
  );
}

function AccountingReportsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-44 w-full" />
      ))}
    </div>
  );
}

async function AccountingReportsSection() {
  const actor = await requirePagePermission("accounting.view");
  const reports = listReportsForRoles(actor.roles).filter((report) =>
    FINANCE_SLUGS.has(report.slug),
  );

  return (
    <>
      {reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada laporan keuangan untuk role Anda</CardTitle>
            <CardDescription>Hubungi administrator untuk mendapatkan akses.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <Link key={report.slug} href={`/reports?report=${report.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-brand/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                      {report.slug === "payroll-summary" ? (
                        <BarChart3 className="size-4" />
                      ) : (
                        <FileBarChart className="size-4" />
                      )}
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong" />
                  </div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    Buka laporan
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

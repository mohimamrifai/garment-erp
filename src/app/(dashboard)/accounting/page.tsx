import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  BookOpenCheck,
  CalendarCheck,
  Landmark,
  ReceiptText,
  ScrollText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { formatIdr } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { JournalStatusBadge } from "@/modules/accounting/components/status-badges";
import {
  getFinanceSummary,
  listFiscalPeriods,
  listRecentJournals,
} from "@/modules/accounting/service";
import type { JournalStatus } from "@/modules/accounting/status";

export const metadata: Metadata = { title: "Akuntansi" };

export default function AccountingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Akuntansi"
        description="Ringkasan keuangan, jurnal terbaru, dan status tutup buku."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href="/accounting/reports" />}>
              <ReceiptText data-icon="inline-start" />
              Laporan
            </Button>
            <Button render={<Link href="/accounting/journals" />}>
              <ScrollText data-icon="inline-start" />
              Buka Jurnal
            </Button>
          </div>
        }
      />
      <Suspense fallback={<AccountingSkeleton />}>
        <AccountingSection />
      </Suspense>
    </div>
  );
}

function AccountingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

async function AccountingSection() {
  await requirePagePermission("accounting.view");
  const [summary, journals, periods] = await Promise.all([
    getFinanceSummary(),
    listRecentJournals(8),
    listFiscalPeriods(),
  ]);
  const currentMonth = getTodayDate().slice(0, 7);
  const currentPeriod = periods.find(
    (period) => `${period.year}-${String(period.month).padStart(2, "0")}` === currentMonth,
  );

  const cards = [
    { label: "Kas & Bank", value: summary.cashBalance, icon: Wallet },
    { label: "Piutang Usaha", value: summary.receivables, icon: TrendingUp },
    { label: "Utang Usaha", value: summary.payables, icon: TrendingDown },
    { label: "Pendapatan bulan ini", value: summary.revenue, icon: Banknote },
    { label: "Beban bulan ini", value: summary.expenses, icon: ReceiptText },
    { label: "Laba bersih bulan ini", value: summary.netIncome, icon: Landmark },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Icon className="size-3.5" />
                  {card.label}
                </CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums">
                  {formatIdr(card.value)}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Jurnal Terbaru</CardTitle>
              <CardDescription>Delapan jurnal terakhir yang tercatat.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/accounting/journals" />}>
              Lihat semua
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {journals.length === 0 ? (
              <p className="px-6 text-[13px] text-muted-foreground">Belum ada jurnal.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-6">Nomor</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journals.map((journal) => (
                      <TableRow key={journal.id}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/accounting/journals/${journal.id}`}
                            className="font-mono text-[12px] font-medium underline underline-offset-4 hover:text-brand-strong"
                          >
                            {journal.number}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-[12px] tabular-nums">
                          {formatDateId(journal.date)}
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-[12px]">
                          {journal.description}
                        </TableCell>
                        <TableCell>
                          <JournalStatusBadge status={journal.status as JournalStatus} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6 text-right font-mono text-[12px] tabular-nums">
                          {formatIdr(journal.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardDescription>Periode berjalan</CardDescription>
              <CardTitle className="text-base">{currentMonth}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {currentPeriod?.status === "CLOSED"
                    ? "Ditutup"
                    : currentPeriod
                      ? "Terbuka"
                      : "Belum ada transaksi"}
                </span>
              </div>
              <Button variant="outline" render={<Link href="/accounting/periods" />}>
                <CalendarCheck data-icon="inline-start" />
                Kelola Tutup Buku
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Akses cepat</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Bagan Akun", href: "/accounting/accounts", icon: BookOpenCheck },
                { label: "Jurnal", href: "/accounting/journals", icon: ScrollText },
                { label: "Kas & Bank", href: "/accounting/payments", icon: Banknote },
                { label: "Laporan", href: "/accounting/reports", icon: ReceiptText },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                    variant="outline"
                    className="justify-start"
                    render={<Link href={item.href} />}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

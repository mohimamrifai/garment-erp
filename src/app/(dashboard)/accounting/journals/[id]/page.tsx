import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatIdr } from "@/lib/utils/currency";
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { JournalDetailActions } from "@/modules/accounting/components/journal-detail-actions";
import { JournalStatusBadge } from "@/modules/accounting/components/status-badges";
import { CASH_FLOW_LABELS } from "@/modules/accounting/schemas";
import { getJournalDetail } from "@/modules/accounting/service";
import { SOURCE_TYPE_LABELS, type JournalStatus } from "@/modules/accounting/status";

export const metadata: Metadata = { title: "Detail Jurnal" };

type JournalDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function JournalDetailPage({ params }: JournalDetailPageProps) {
  return (
    <Suspense fallback={<JournalDetailSkeleton />}>
      <JournalDetailSection params={params} />
    </Suspense>
  );
}

function JournalDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function JournalDetailSection({ params }: JournalDetailPageProps) {
  const actor = await requirePagePermission("accounting.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getJournalDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { entry, lines } = detail;
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-3"
          render={<Link href="/accounting/journals" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Kembali ke Jurnal
        </Button>
        <PageHeader
          title={`Jurnal ${entry.number}`}
          description={entry.description}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <JournalStatusBadge status={entry.status as JournalStatus} />
              <JournalDetailActions
                journalId={entry.id}
                number={entry.number}
                status={entry.status}
                canPost={can(actor.roles, "accounting.post")}
              />
            </div>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Jurnal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Tanggal</span>
            <span className="font-mono tabular-nums">{formatDateId(entry.journalDate)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Sumber</span>
            <span>{SOURCE_TYPE_LABELS[entry.sourceType] ?? entry.sourceType}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Kategori arus kas</span>
            <span>{CASH_FLOW_LABELS[entry.cashFlowCategory]}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Diposting</span>
            <span className="font-mono tabular-nums">
              {entry.postedAt ? formatDateTimeId(entry.postedAt) : "—"}
            </span>
          </div>
          {entry.reversalOfId ? (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-muted-foreground">Jurnal asli</span>
              <Link
                href={`/accounting/journals/${entry.reversalOfId}`}
                className="inline-flex items-center gap-1.5 font-mono text-[12px] text-brand-strong underline underline-offset-4"
              >
                <Link2 className="size-3.5" />
                Lihat jurnal asli
              </Link>
            </div>
          ) : null}
          {entry.sourceId && entry.sourceType === "payroll-run" ? (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-muted-foreground">Dokumen sumber</span>
              <Link
                href={`/payroll/${entry.sourceId}`}
                className="inline-flex items-center gap-1.5 font-mono text-[12px] text-brand-strong underline underline-offset-4"
              >
                <BookOpen className="size-3.5" />
                Lihat payroll
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Akun</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium">{line.accountName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {line.accountCode}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {line.description ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-[12px] tabular-nums">
                  {Number(line.debit) === 0 ? "—" : formatIdr(line.debit)}
                </TableCell>
                <TableCell className="text-right font-mono text-[12px] tabular-nums">
                  {Number(line.credit) === 0 ? "—" : formatIdr(line.credit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {formatIdr(totalDebit)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {formatIdr(totalCredit)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatIdr } from "@/lib/utils/currency";
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { listCashBankAccounts } from "@/modules/accounting/service";
import { PayrollRunActions } from "@/modules/payroll/components/payroll-run-actions";
import { PayrollStatusBadge } from "@/modules/payroll/components/payroll-status-badge";
import { PayslipsTable } from "@/modules/payroll/components/payslips-table";
import { getPayrollRunDetail } from "@/modules/payroll/service";
import type { PayrollStatus } from "@/modules/payroll/status";

export const metadata: Metadata = { title: "Detail Payroll" };

type PayrollDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function PayrollDetailPage({ params }: PayrollDetailPageProps) {
  return (
    <Suspense fallback={<PayrollDetailSkeleton />}>
      <PayrollDetailSection params={params} />
    </Suspense>
  );
}

function PayrollDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function PayrollDetailSection({ params }: PayrollDetailPageProps) {
  const actor = await requirePagePermission("payroll.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getPayrollRunDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const accounts = await listCashBankAccounts();
  const { run, payslips } = detail;
  const status = run.status as PayrollStatus;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-3" render={<Link href="/payroll" />}>
          <ArrowLeft data-icon="inline-start" />
          Kembali ke Payroll
        </Button>
        <PageHeader
          title={`Payroll ${run.period}`}
          description={`Nomor ${run.number} · ${formatDateId(run.startDate)} – ${formatDateId(run.endDate)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PayrollStatusBadge status={status} />
              <PayrollRunActions
                runId={run.id}
                number={run.number}
                status={run.status}
                totalNet={run.totalNet}
                accounts={accounts.map((account) => ({
                  id: account.id,
                  code: account.code,
                  name: account.name,
                }))}
                canApprove={can(actor.roles, "payroll.approve")}
                canPay={can(actor.roles, "payroll.pay")}
                canCancel={can(actor.roles, "payroll.run")}
              />
            </div>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="size-3.5" />
              Karyawan
            </CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{payslips.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gaji bruto</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatIdr(run.totalGross)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Potongan karyawan</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatIdr(run.totalDeductions)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="size-3.5" />
              Gaji neto
            </CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatIdr(run.totalNet)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Payroll</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Kontribusi perusahaan</span>
            <span className="font-mono tabular-nums">
              {formatIdr(run.totalEmployerContributions)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Disetujui</span>
            <span className="font-mono tabular-nums">
              {run.approvedAt ? formatDateTimeId(run.approvedAt) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Dibayar</span>
            <span className="font-mono tabular-nums">
              {run.paidAt ? formatDateTimeId(run.paidAt) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Jurnal akuntansi</span>
            {run.journalEntryId ? (
              <Link
                href={`/accounting/journals/${run.journalEntryId}`}
                className="inline-flex items-center gap-1.5 font-mono text-[12px] text-brand-strong underline underline-offset-4"
              >
                <BookOpen className="size-3.5" />
                Lihat jurnal
              </Link>
            ) : (
              <span className="text-muted-foreground">Belum diposting</span>
            )}
          </div>
          {run.cancelReason ? (
            <div className="flex flex-col gap-1 sm:col-span-2 xl:col-span-4">
              <span className="text-muted-foreground">Alasan pembatalan</span>
              <span>{run.cancelReason}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold tracking-tight">Slip Gaji</h2>
        </div>
        <PayslipsTable payslips={payslips} />
      </div>
    </div>
  );
}

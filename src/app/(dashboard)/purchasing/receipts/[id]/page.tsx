import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatQty } from "@/lib/utils/currency";
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { ReceiptDetailActions } from "@/modules/purchasing/components/receipt-detail-actions";
import { ReceiptStatusBadge } from "@/modules/purchasing/components/purchasing-badges";
import { getMaterialReceiptDetail } from "@/modules/purchasing/service";

export const metadata: Metadata = { title: "Detail Penerimaan Material" };

type MaterialReceiptDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function MaterialReceiptDetailPage({ params }: MaterialReceiptDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<MaterialReceiptDetailSkeleton />}>
        <MaterialReceiptDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function MaterialReceiptDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function MaterialReceiptDetailSection({ params }: MaterialReceiptDetailPageProps) {
  const actor = await requirePagePermission("receipt.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getMaterialReceiptDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { receipt, purchaseOrder, location, items, transactions, totals } = detail;
  const materialNameById = new Map(items.map((item) => [item.materialId, item.materialName]));

  return (
    <>
      <PageHeader
        title={receipt.number}
        description={`${purchaseOrder.number} · ${purchaseOrder.supplierName} · ${totals.itemCount} item`}
        actions={
          <>
            <Link
              href="/purchasing/receipts"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Daftar Penerimaan
            </Link>
            <ReceiptDetailActions
              materialReceiptId={receipt.id}
              number={receipt.number}
              status={receipt.status}
              canUpdate={can(actor.roles, "receipt.update")}
              canPost={can(actor.roles, "receipt.post")}
              canCancel={can(actor.roles, "receipt.cancel")}
            />
          </>
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd>
            <ReceiptStatusBadge status={receipt.status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Purchase Order
          </dt>
          <dd>
            <Link
              href={`/purchasing/${purchaseOrder.id}`}
              className="nums rounded-sm font-mono text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {purchaseOrder.number}
            </Link>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tanggal Terima
          </dt>
          <dd className="nums font-mono text-sm">{formatDateId(receipt.receivedAt)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Lokasi Penyimpanan
          </dt>
          <dd className="text-sm font-medium">{location.name}</dd>
          <dd className="font-mono text-[11px] text-muted-foreground">
            {location.code} · {location.warehouseName}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibuat
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {formatDateTimeId(receipt.createdAt)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Diposting
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {receipt.postedAt ? formatDateTimeId(receipt.postedAt) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibatalkan
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {receipt.cancelledAt ? formatDateTimeId(receipt.cancelledAt) : "—"}
          </dd>
        </div>
        {receipt.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-3">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Catatan
            </dt>
            <dd className="text-sm">{receipt.notes}</dd>
          </div>
        ) : null}
      </dl>

      {receipt.status === "CANCELLED" && receipt.cancelReason ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px]">
          <span className="font-medium text-destructive">Penerimaan dibatalkan.</span>{" "}
          <span className="text-muted-foreground">{receipt.cancelReason}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Item Diterima
        </h2>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-28 text-right">Dipesan (PO)</TableHead>
                <TableHead className="w-28 text-right">Diterima</TableHead>
                <TableHead className="w-32 text-right">Diterima Baik</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.materialName}</span>
                      <span className="nums font-mono text-[11px] text-muted-foreground">
                        {item.materialCode} · {item.unitCode}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.orderedQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.receivedQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.acceptedQuantity)}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {item.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell />
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(totals.totalReceived)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(totals.totalAccepted)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Mutasi Stok
        </h2>

        {transactions.length === 0 ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyTitle>Belum ada mutasi stok</EmptyTitle>
              <EmptyDescription>
                Mutasi stok tercatat otomatis oleh inventory engine saat penerimaan diposting.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Nomor</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-28 text-right">Jumlah</TableHead>
                  <TableHead className="w-40">Waktu</TableHead>
                  <TableHead className="w-40">Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="nums font-mono text-[13px] font-medium">
                      {transaction.number}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {transaction.materialId
                        ? (materialNameById.get(transaction.materialId) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      +{formatQty(transaction.quantity)}
                    </TableCell>
                    <TableCell className="nums font-mono text-xs text-muted-foreground">
                      {formatDateTimeId(transaction.postedAt)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {transaction.postedByName ?? "Sistem"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

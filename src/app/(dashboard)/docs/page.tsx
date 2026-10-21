import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Factory, PackageCheck, ShoppingCart, Truck, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { can, ROLE_SEED, type Permission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dokumentasi" };

type ModuleGuide = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
};

const MODULES: readonly ModuleGuide[] = [
  {
    title: "Penjualan",
    description: "Kelola buyer, sales order, konfirmasi pesanan, dan pembatalan.",
    href: "/sales",
    icon: ShoppingCart,
    permission: "so.view",
  },
  {
    title: "Pembelian & Gudang",
    description: "Purchase order, penerimaan material, stok, dan mutasi barang.",
    href: "/purchasing",
    icon: PackageCheck,
    permission: "po.view",
  },
  {
    title: "Produksi & QC",
    description: "SPK, progres produksi, pemakaian material, dan inspeksi kualitas.",
    href: "/production",
    icon: Factory,
    permission: "production.view",
  },
  {
    title: "Pengiriman",
    description: "Alokasi barang jadi, surat jalan, dan serah terima ke buyer.",
    href: "/shipping",
    icon: Truck,
    permission: "shipment.view",
  },
];

const NOTES = [
  "Semua perubahan stok tercatat sebagai mutasi. Gunakan penerimaan, pengeluaran, transfer, atau penyesuaian—bukan mengubah saldo secara langsung.",
  "Dokumen yang sudah diposting tidak diedit ulang. Koreksi dilakukan lewat pembatalan atau dokumen baru sesuai alur.",
  "Audit Log menyimpan aktor, aksi, entitas, dan perubahan penting. Hanya Administrator yang dapat membukanya.",
  "Gunakan filter status, periode, dan pencarian untuk mempersempit daftar dokumen.",
] as const;

function DocsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

async function DocsContent() {
  const user = await getSessionUser();
  if (!user) return null;

  const modules = MODULES.filter((module) => can(user.roles, module.permission));

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Card key={module.href} className="flex flex-col">
            <CardHeader>
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <module.icon className="size-4" />
              </div>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={module.href} />}
              >
                Buka modul
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Peran & akses</CardTitle>
            <CardDescription>
              Menu dan tindakan mengikuti role yang diberikan oleh Administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {ROLE_SEED.map((role) => (
              <div key={role.code} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{role.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {role.code}
                  </Badge>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catatan operasional</CardTitle>
            <CardDescription>Hal penting agar data dan alur kerja tetap konsisten.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {NOTES.map((note) => (
                <li key={note} className="flex gap-2.5 text-[13px] leading-relaxed">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dokumentasi"
        description="Panduan singkat penggunaan modul dan akses per role di Garment ERP."
      />
      <Suspense fallback={<DocsSkeleton />}>
        <DocsContent />
      </Suspense>
    </div>
  );
}

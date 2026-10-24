import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  Factory,
  Landmark,
  PackageCheck,
  ShoppingCart,
  Truck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/permissions";
import { RoleGuide } from "./_components/role-guide";

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
  {
    title: "HRIS",
    description: "Data karyawan, absensi, cuti, dan kesiapan payroll.",
    href: "/hr/attendance",
    icon: UsersRound,
    permission: "hr.attendance.view",
  },
  {
    title: "Payroll",
    description: "Hitung gaji, BPJS, PPh 21, slip gaji, dan pembayaran.",
    href: "/payroll",
    icon: Wallet,
    permission: "payroll.view",
  },
  {
    title: "Akuntansi",
    description: "Jurnal, kas/bank, tutup buku, dan laporan keuangan.",
    href: "/accounting",
    icon: Landmark,
    permission: "accounting.view",
  },
];

const NOTES = [
  "Semua perubahan stok tercatat sebagai mutasi. Gunakan penerimaan, pengeluaran, transfer, atau penyesuaian—bukan mengubah saldo secara langsung.",
  "Dokumen yang sudah diposting tidak diedit ulang. Koreksi dilakukan lewat pembatalan atau dokumen baru sesuai alur.",
  "Audit Log menyimpan aktor, aksi, entitas, dan perubahan penting. Hanya Administrator yang dapat membukanya.",
  "Gunakan filter status, periode, dan pencarian untuk mempersempit daftar dokumen.",
  "Payroll yang sudah disetujui tidak dapat diubah. Koreksi setelah posting dilakukan lewat jurnal pembalik, bukan menghapus jurnal.",
  "Tutup buku hanya setelah semua jurnal periode diposting dan laporan keuangan diperiksa.",
] as const;

function DocsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full max-w-2xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function DocsContent() {
  const user = await getSessionUser();
  if (!user) return null;

  const modules = MODULES.filter((module) => can(user.roles, module.permission));

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Panduan per role</h2>
          <p className="text-[13px] text-muted-foreground">
            Pilih role untuk melihat langkah kerja, menu utama, dan catatan pentingnya.
          </p>
        </div>
        <RoleGuide currentRoles={user.roles} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Jelajahi modul</h2>
          <p className="text-[13px] text-muted-foreground">
            Pintasan ke modul yang dapat Anda akses dengan role saat ini.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Catatan operasional</CardTitle>
          <CardDescription>Hal penting agar data dan alur kerja tetap konsisten.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
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
    </>
  );
}

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dokumentasi"
        description="Panduan penggunaan per role dan ringkasan modul Garment ERP."
      />
      <Suspense fallback={<DocsSkeleton />}>
        <DocsContent />
      </Suspense>
    </div>
  );
}

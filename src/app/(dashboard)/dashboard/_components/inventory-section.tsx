import Link from "next/link";
import { AlertTriangle, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getDashboardInventorySummary } from "@/modules/inventory/service";
import { StatTile } from "./stat-tile";

export async function InventorySummarySection() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "inventory.view")) return null;

  const summary = await getDashboardInventorySummary();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Stok gudang</CardTitle>
            <CardDescription>
              Kondisi saldo material aktif dibandingkan stok minimum yang ditetapkan.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/inventory" />}
          >
            <Boxes data-icon="inline-start" />
            Buka Inventori
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2">
        <StatTile
          label="Di bawah stok minimum"
          value={summary.lowStockCount}
          hint="material aktif yang perlu restock"
        />
        <StatTile
          label="Material bersaldo"
          value={summary.stockedMaterialCount}
          hint="material dengan stok tercatat di gudang"
        />
      </CardContent>
      {summary.lowStockCount > 0 ? (
        <div className="flex items-center gap-2 border-t bg-warning/5 px-4 py-3 text-[13px] text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            {summary.lowStockCount} material perlu restock.{" "}
            <Link
              href="/inventory?low=1"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Lihat daftar
            </Link>
          </span>
        </div>
      ) : null}
    </Card>
  );
}

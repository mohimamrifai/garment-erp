import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PIPELINE = [
  {
    code: "SO",
    name: "Sales Order",
    description: "Order buyer, item, ukuran, dan tenggat kirim.",
  },
  {
    code: "PO",
    name: "Pembelian",
    description: "Purchase order bahan dan aksesori ke supplier.",
  },
  {
    code: "RCV",
    name: "Penerimaan & Stok",
    description: "Penerimaan barang, stok masuk/keluar, dan kartu stok.",
  },
  {
    code: "SPK",
    name: "Produksi & QC",
    description: "Surat perintah kerja, progres produksi, dan quality control.",
  },
  {
    code: "SJ",
    name: "Pengiriman",
    description: "Surat jalan, alokasi barang jadi, dan serah terima ke buyer.",
  },
] as const;

export function PipelineCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>Alur pesanan hingga pengiriman</CardTitle>
        <CardDescription>
          Urutan dokumen operasional dari pesanan buyer sampai surat jalan.
        </CardDescription>
      </CardHeader>
      <div className="divide-y">
        {PIPELINE.map((step) => (
          <div key={step.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-14 shrink-0 rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 text-center font-mono text-[11px] tracking-wide text-foreground/80">
              {step.code}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{step.name}</span>
              <span className="text-xs text-muted-foreground">{step.description}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

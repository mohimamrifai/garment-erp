import type { ReactNode } from "react";
import { ArrowRight, Factory } from "lucide-react";

const PIPELINE_STEPS = [
  { code: "SO", label: "Sales Order" },
  { code: "PO", label: "Purchase Order" },
  { code: "RCV", label: "Penerimaan Barang" },
  { code: "SPK", label: "Surat Perintah Kerja" },
  { code: "SJ", label: "Surat Jalan" },
] as const;

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
        <Factory className="size-5" />
      </div>
      <span className="font-mono text-sm font-semibold tracking-[0.14em] uppercase">Garment ERP</span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Panel kiri: identitas — "blueprint" pabrik. Disembunyikan di layar kecil. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--sidebar-foreground) 4%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--sidebar-foreground) 4%, transparent) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <BrandMark />
        </div>
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
              Order sampai pengiriman, satu sumber data.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-sidebar-foreground/70">
              Sales order, produksi, stok, dan pengiriman garmen dalam satu sistem terpusat
              dengan jejak audit.
            </p>
          </div>
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {PIPELINE_STEPS.map((step, index) => (
              <li key={step.code} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <ArrowRight aria-hidden className="size-3 text-sidebar-foreground/40" />
                ) : null}
                <span
                  title={step.label}
                  className="rounded-sm border border-sidebar-border bg-sidebar-foreground/5 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-sidebar-foreground/80"
                >
                  {step.code}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="relative font-mono text-[11px] tracking-widest text-sidebar-foreground/50 uppercase">
          ERP Manufaktur Garmen — v0.1
        </p>
      </aside>

      {/* Panel kanan: formulir. */}
      <main className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="lg:hidden">
          <BrandMark />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

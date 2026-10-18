import type { ReactNode } from "react";
import { Factory } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Factory className="size-5" />
        Garment ERP
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-xs text-muted-foreground">ERP manufaktur garmen — order to shipment.</p>
    </div>
  );
}

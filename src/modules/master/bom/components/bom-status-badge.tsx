import { Badge } from "@/components/ui/badge";

/** Badge status BOM: Aktif (beku) atau Draf (dapat diedit). */
export function BomStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        Aktif
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
      Draf
    </Badge>
  );
}

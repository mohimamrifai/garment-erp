import { Badge } from "@/components/ui/badge";

/** Badge status aktif/nonaktif standar untuk seluruh master data. */
export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        Aktif
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
      Nonaktif
    </Badge>
  );
}

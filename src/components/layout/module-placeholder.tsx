import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Halaman placeholder untuk modul yang belum diimplementasikan.
 * Tidak membaca data apa pun sehingga tetap statis.
 */
export function ModulePlaceholder({
  icon: Icon,
  title,
  phase,
  description,
}: {
  icon: LucideIcon;
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="justify-items-center text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-6" />
          </div>
          <CardTitle className="flex flex-wrap items-center justify-center gap-2">
            {title}
            <Badge variant="secondary">{phase}</Badge>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Modul ini belum aktif dan dijadwalkan pada {phase} sesuai rencana bertahap.
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Akses Ditolak" };

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldX className="size-6" />
          </div>
          <CardTitle>Akses ditolak</CardTitle>
          <CardDescription>
            Anda tidak memiliki izin untuk membuka halaman ini. Hubungi Administrator bila ini
            keliru.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

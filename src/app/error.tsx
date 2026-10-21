"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle>Terjadi kesalahan</CardTitle>
          <CardDescription>
            Permintaan tidak dapat diselesaikan. Coba muat ulang halaman; bila masalah berlanjut,
            hubungi Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <RotateCcw data-icon="inline-start" />
              Coba Lagi
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
              Ke Dashboard
            </Button>
          </div>
          {error.digest ? (
            <p className="font-mono text-[11px] text-muted-foreground">Kode: {error.digest}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

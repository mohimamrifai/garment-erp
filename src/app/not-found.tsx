import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileQuestion className="size-6" />
          </div>
          <CardTitle>Halaman tidak ditemukan</CardTitle>
          <CardDescription>
            Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautan
            atau kembali ke dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

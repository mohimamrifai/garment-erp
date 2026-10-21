import Link from "next/link";
import { Handshake, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { can, roleLabel } from "@/lib/permissions";
import { listBuyers } from "@/modules/buyer/service";
import { listUsers } from "@/modules/user/service";
import { StatTile } from "./stat-tile";

type SummaryTile = {
  key: string;
  label: string;
  value: number;
  hint: string;
};

export async function SummarySection() {
  const user = await getSessionUser();
  if (!user) return null;

  const showBuyers = can(user.roles, "buyer.view");
  const showUsers = can(user.roles, "user.view");

  const buyerCount = showBuyers
    ? (await listBuyers({ status: "all", page: 1, pageSize: 1 })).total
    : null;
  const userCount = showUsers ? (await listUsers({ page: 1, pageSize: 1 })).total : null;

  const tiles: SummaryTile[] = [];
  if (buyerCount !== null) {
    tiles.push({ key: "buyers", label: "Buyer terdaftar", value: buyerCount, hint: "master data" });
  }
  if (userCount !== null) {
    tiles.push({ key: "users", label: "Pengguna sistem", value: userCount, hint: "akun & role" });
  }

  const roleNames = user.roles.map(roleLabel).join(", ");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Selamat datang, {user.name}</CardTitle>
            <CardDescription>Masuk sebagai {roleNames || "pengguna"}.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showBuyers ? (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/buyers" />}>
                <Handshake data-icon="inline-start" />
                Kelola Buyer
              </Button>
            ) : null}
            {showUsers ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/settings/users" />}
              >
                <Users data-icon="inline-start" />
                Manajemen Pengguna
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {tiles.length > 0 ? (
        <CardContent
          className={`grid gap-px bg-border p-0 ${
            tiles.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"
          }`}
        >
          {tiles.map((tile) => (
            <StatTile key={tile.key} label={tile.label} value={tile.value} hint={tile.hint} />
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

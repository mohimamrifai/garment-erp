"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/permissions";
import { formatDateId } from "@/lib/utils/dates";
import type { ManagedUser } from "../service";
import { UserRowActions } from "./user-row-actions";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function UsersTable({
  users,
  currentUserId,
  canManage,
}: {
  users: ManagedUser[];
  currentUserId: string;
  canManage: boolean;
}) {
  if (users.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Users />
          </EmptyMedia>
          <EmptyTitle>Pengguna tidak ditemukan</EmptyTitle>
          <EmptyDescription>Tidak ada pengguna yang cocok dengan pencarian Anda.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pengguna</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dibuat</TableHead>
            {canManage ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initialsOf(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {user.name}
                      {user.id === currentUserId ? <Badge variant="outline">Anda</Badge> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Tanpa role</span>
                  ) : (
                    user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {roleLabel(role)}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>
                {user.banned ? (
                  <Badge variant="destructive">Nonaktif</Badge>
                ) : (
                  <Badge variant="outline">Aktif</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateId(user.createdAt)}
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <UserRowActions user={user} isSelf={user.id === currentUserId} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

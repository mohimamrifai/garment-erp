"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ManagedUser } from "../service";
import { BanUserDialog, EditNameDialog, ResetPasswordDialog, RolesDialog } from "./user-dialogs";

type ActiveDialog = "edit" | "roles" | "password" | "ban" | null;

export function UserRowActions({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${user.name}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialog("edit")}>Ubah Nama</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("roles")}>Atur Role</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("password")}>
              Reset Password
            </DropdownMenuItem>
            <DropdownMenuItem
              variant={user.banned ? "default" : "destructive"}
              disabled={isSelf}
              onClick={() => setDialog("ban")}
            >
              {user.banned ? "Aktifkan Kembali" : "Nonaktifkan"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "edit" ? <EditNameDialog user={user} onClose={close} /> : null}
      {dialog === "roles" ? <RolesDialog user={user} onClose={close} /> : null}
      {dialog === "password" ? <ResetPasswordDialog user={user} onClose={close} /> : null}
      {dialog === "ban" ? <BanUserDialog user={user} onClose={close} /> : null}
    </>
  );
}

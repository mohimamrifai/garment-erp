"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { ROLE_SEED, type RoleCode } from "@/lib/permissions";
import type { ManagedUser } from "../service";
import {
  setUserBanSchema,
  setUserPasswordSchema,
  setUserRolesSchema,
  updateUserSchema,
  type SetUserPasswordInput,
  type SetUserRolesInput,
  type UpdateUserInput,
} from "../schemas";

type UserDialogProps = {
  user: ManagedUser;
  onClose: () => void;
};

/** Ubah nama pengguna. Dirender hanya saat terbuka agar state form selalu segar. */
export function EditNameDialog({ user, onClose }: UserDialogProps) {
  const router = useRouter();
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      toast.success("Nama pengguna diperbarui.");
      onClose();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan.",
      });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Nama</DialogTitle>
          <DialogDescription>Ubah nama tampilan untuk {user.email}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="edit-user-name">Nama</FieldLabel>
              <Input
                id="edit-user-name"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Atur ulang seluruh role pengguna. */
export function RolesDialog({ user, onClose }: UserDialogProps) {
  const router = useRouter();
  const form = useForm<SetUserRolesInput>({
    resolver: zodResolver(setUserRolesSchema),
    defaultValues: { roleCodes: user.roles },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/users/${user.id}/roles`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      toast.success("Role pengguna diperbarui.");
      onClose();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan.",
      });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atur Role</DialogTitle>
          <DialogDescription>
            Pilih role untuk {user.name}. Satu pengguna boleh memiliki beberapa role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <Field data-invalid={Boolean(errors.roleCodes) || undefined}>
            <Controller
              control={form.control}
              name="roleCodes"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLE_SEED.map((role) => (
                    <Field key={role.code} orientation="horizontal">
                      <Checkbox
                        id={`edit-role-${role.code}`}
                        checked={field.value.includes(role.code)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? ([...field.value, role.code] as RoleCode[])
                              : field.value.filter((code) => code !== role.code),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`edit-role-${role.code}`}>{role.name}</FieldLabel>
                    </Field>
                  ))}
                </div>
              )}
            />
            {errors.roleCodes ? <FieldError>{errors.roleCodes.message}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reset password pengguna oleh Administrator. */
export function ResetPasswordDialog({ user, onClose }: UserDialogProps) {
  const router = useRouter();
  const form = useForm<SetUserPasswordInput>({
    resolver: zodResolver(setUserPasswordSchema),
    defaultValues: { newPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/users/${user.id}/password`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Password pengguna diperbarui.");
      onClose();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan.",
      });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Password baru untuk {user.name}. Sampaikan ke pengguna dan minta segera diganti.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <FieldGroup>
            <Field data-invalid={Boolean(errors.newPassword) || undefined}>
              <FieldLabel htmlFor="reset-password">Password baru</FieldLabel>
              <Input
                id="reset-password"
                type="text"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.newPassword) || undefined}
                {...form.register("newPassword")}
              />
              {errors.newPassword ? <FieldError>{errors.newPassword.message}</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Nonaktifkan atau aktifkan kembali pengguna. */
export function BanUserDialog({ user, onClose }: UserDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const banning = !user.banned;

  async function submit() {
    const parsed = setUserBanSchema.safeParse({
      banned: banning,
      reason: reason.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Alasan tidak valid.");
      return;
    }

    setPending(true);
    try {
      await requestJson(`/api/v1/users/${user.id}/ban`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success(banning ? "Pengguna dinonaktifkan." : "Pengguna diaktifkan kembali.");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menyimpan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{banning ? "Nonaktifkan Pengguna" : "Aktifkan Kembali"}</DialogTitle>
          <DialogDescription>
            {banning
              ? `${user.name} tidak akan bisa masuk sampai diaktifkan kembali.`
              : `${user.name} akan bisa masuk kembali dengan role yang sama.`}
          </DialogDescription>
        </DialogHeader>
        {banning ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ban-reason">Alasan (opsional)</FieldLabel>
              <Textarea
                id="ban-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Mis. mutasi keluar, pelanggaran kebijakan..."
                rows={3}
              />
            </Field>
          </FieldGroup>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant={banning ? "destructive" : "default"}
            disabled={pending}
            onClick={submit}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {banning ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { ROLE_SEED } from "@/lib/permissions";
import { createUserSchema, type CreateUserInput } from "../schemas";

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", roleCodes: ["SALES"] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson("/api/v1/users", { method: "POST", body: JSON.stringify(values) });
      toast.success("Pengguna berhasil dibuat.");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "Gagal membuat pengguna.";
      form.setError("root", { message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus data-icon="inline-start" />
        Tambah Pengguna
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna</DialogTitle>
          <DialogDescription>Buat akun baru dan tentukan role-nya.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="new-user-name">Nama</FieldLabel>
              <Input
                id="new-user-name"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
              <Input
                id="new-user-email"
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(errors.email) || undefined}
                {...form.register("email")}
              />
              {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="new-user-password">Password awal</FieldLabel>
              <Input
                id="new-user-password"
                type="text"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password) || undefined}
                {...form.register("password")}
              />
              <FieldDescription>
                Minimal 8 karakter. Sampaikan ke pengguna agar segera diganti.
              </FieldDescription>
              {errors.password ? <FieldError>{errors.password.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.roleCodes) || undefined}>
              <FieldLabel>Role</FieldLabel>
              <Controller
                control={form.control}
                name="roleCodes"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLE_SEED.map((role) => (
                      <Field key={role.code} orientation="horizontal">
                        <Checkbox
                          id={`role-${role.code}`}
                          checked={field.value.includes(role.code)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role.code]
                                : field.value.filter((code) => code !== role.code),
                            )
                          }
                        />
                        <FieldLabel htmlFor={`role-${role.code}`}>{role.name}</FieldLabel>
                      </Field>
                    ))}
                  </div>
                )}
              />
              {errors.roleCodes ? <FieldError>{errors.roleCodes.message}</FieldError> : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

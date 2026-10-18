"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/demo-accounts";
import { roleLabel } from "@/lib/permissions";
import { loginSchema, type LoginInput } from "@/modules/auth/schemas";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email atau password salah.",
  INVALID_PASSWORD: "Password salah.",
  USER_NOT_FOUND: "Akun tidak ditemukan.",
  BANNED_USER: "Akun ini dinonaktifkan. Hubungi Administrator.",
};

/** Tombol masuk cepat akun demo hanya tampil bila deployment menyalakannya. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

function normalizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function signInWith(email: string, password: string) {
    setFormError(null);
    const { error } = await authClient.signIn.email({ email, password });

    if (error) {
      setFormError(
        ERROR_MESSAGES[error.code ?? ""] ?? "Gagal masuk. Periksa kembali email dan password Anda.",
      );
      return;
    }

    router.replace(normalizeNextPath(searchParams.get("next")));
    router.refresh();
  }

  const onSubmit = handleSubmit(async (values) => {
    await signInWith(values.email, values.password);
  });

  async function handleDemoSignIn(account: DemoAccount) {
    setPendingEmail(account.email);
    try {
      await signInWith(account.email, DEMO_PASSWORD);
    } finally {
      setPendingEmail(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Gagal masuk</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@garment.local"
              className="h-9"
              aria-invalid={Boolean(errors.email) || undefined}
              {...register("email")}
            />
            {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
          </Field>

          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-9"
              aria-invalid={Boolean(errors.password) || undefined}
              {...register("password")}
            />
            {errors.password ? <FieldError>{errors.password.message}</FieldError> : null}
          </Field>
        </FieldGroup>

        <Button type="submit" className="h-9" disabled={isSubmitting || pendingEmail !== null}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Masuk
        </Button>
      </form>

      {DEMO_MODE ? (
        <section aria-labelledby="akun-demo" className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-border" />
            <h2
              id="akun-demo"
              className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
            >
              Masuk cepat — akun demo
            </h2>
            <span aria-hidden className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingEmail !== null}
                onClick={() => void handleDemoSignIn(account)}
                className="h-auto justify-start gap-2 px-2.5 py-2"
              >
                {pendingEmail === account.email ? (
                  <Spinner className="size-3.5 shrink-0" />
                ) : (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />
                )}
                <span className="flex min-w-0 flex-col items-start text-left">
                  <span className="truncate text-xs font-medium">{roleLabel(account.roleCode)}</span>
                  <span className="nums truncate font-mono text-[10px] font-normal text-muted-foreground">
                    {account.email}
                  </span>
                </span>
              </Button>
            ))}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Semua akun demo memakai password{" "}
            <span className="font-mono text-foreground/80">{DEMO_PASSWORD}</span>.
          </p>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roleLabel, type RoleCode } from "@/lib/permissions";
import { ROLE_GUIDES } from "../_data/role-guides";

/**
 * Panduan per role dengan pemilih sederhana. Konten tetap dirender di server;
 * komponen ini hanya mengganti panduan yang sedang ditampilkan.
 */
export function RoleGuide({ currentRoles }: { currentRoles: readonly RoleCode[] }) {
  const [active, setActive] = useState<RoleCode>(() => {
    const current = ROLE_GUIDES.find((guide) => currentRoles.includes(guide.code));
    return current?.code ?? "ADMIN";
  });

  const guide = ROLE_GUIDES.find((item) => item.code === active) ?? ROLE_GUIDES[0]!;
  const isCurrentRole = currentRoles.includes(guide.code);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Pilih role" className="flex flex-wrap gap-2">
        {ROLE_GUIDES.map((item) => {
          const selected = item.code === guide.code;
          const current = currentRoles.includes(item.code);

          return (
            <Button
              key={item.code}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={selected}
              onClick={() => setActive(item.code)}
              className={cn(
                "justify-start gap-2",
                selected && "border-brand/50 bg-brand/10 text-foreground hover:bg-brand/15",
              )}
            >
              {roleLabel(item.code)}
              {current ? (
                <span
                  className="size-1.5 rounded-full bg-brand"
                  aria-hidden="true"
                  title="Role Anda"
                />
              ) : null}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{roleLabel(guide.code)}</CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {guide.code}
            </Badge>
            {isCurrentRole ? (
              <Badge className="border-brand/30 bg-brand/10 text-brand-strong">Role Anda</Badge>
            ) : null}
          </div>
          <CardDescription>{guide.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Langkah kerja
            </h3>
            <ol className="mt-3 flex flex-col gap-3.5">
              {guide.steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-[10px] font-semibold text-brand-strong tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm leading-snug font-medium">{step.title}</p>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="flex flex-col gap-4">
            <div>
              <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Menu utama
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {guide.menus.map((menu) => (
                  <Badge key={menu} variant="secondary" className="font-normal">
                    {menu}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
              <p className="text-[10px] font-medium tracking-wider text-brand-strong uppercase">
                Catatan
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{guide.note}</p>
            </div>
          </aside>
        </CardContent>
      </Card>
    </div>
  );
}

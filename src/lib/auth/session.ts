import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles as rolesTable, userRoles } from "@/lib/db/schema";
import { can, isRoleCode, type Permission, type RoleCode } from "@/lib/permissions";
import { auth } from "./index";

/**
 * Data Access Layer (pola resmi Next.js): satu-satunya tempat membaca sesi
 * di sisi server. Selalu panggil dari dalam Server Component / route handler,
 * sedekat mungkin dengan data yang dilindungi.
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleCode[];
};

export async function getSessionUserFromHeaders(
  requestHeaders: Headers,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;

  const roleRows = await db
    .select({ code: rolesTable.code })
    .from(userRoles)
    .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
    .where(eq(userRoles.userId, session.user.id));

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: roleRows.map((row) => row.code).filter(isRoleCode),
  };
}

/** Sesi user saat ini untuk Server Components (di-cache per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  return getSessionUserFromHeaders(await headers());
});

/** Wajib login; redirect ke /login bila belum masuk. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Wajib punya izin; redirect bila tidak. Dipakai halaman (RSC). */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!can(user.roles, permission)) redirect("/akses-ditolak");
  return user;
}

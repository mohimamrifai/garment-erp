import { asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { roles as rolesTable, user as userTable, userRoles } from "@/lib/db/schema";
import type { RoleCode } from "@/lib/permissions";
import type { CreateUserInput, ListUsersQuery } from "./schemas";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  banned: boolean;
  banReason: string | null;
  createdAt: Date;
  roles: RoleCode[];
};

/** Ambil kode error dari error Better Auth (better-call APIError). */
function betterAuthErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "body" in error) {
    return (error as { body?: { code?: string } }).body?.code;
  }
  return undefined;
}

async function getUserRow(
  userId: string,
): Promise<{ id: string; name: string; email: string } | undefined> {
  const [row] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row;
}

async function loadRolesForUsers(userIds: string[]): Promise<Map<string, RoleCode[]>> {
  const map = new Map<string, RoleCode[]>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({ userId: userRoles.userId, code: rolesTable.code })
    .from(userRoles)
    .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
    .where(inArray(userRoles.userId, userIds));

  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.code as RoleCode);
    map.set(row.userId, list);
  }
  return map;
}

export async function listUsers(
  params: ListUsersQuery,
): Promise<{ items: ManagedUser[]; total: number }> {
  const search = params.query?.trim();
  const where = search
    ? or(ilike(userTable.name, `%${search}%`), ilike(userTable.email, `%${search}%`))
    : undefined;

  const [totalRow] = await db.select({ value: count() }).from(userTable).where(where);
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      banned: userTable.banned,
      banReason: userTable.banReason,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(where)
    .orderBy(asc(userTable.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const roleMap = await loadRolesForUsers(rows.map((row) => row.id));
  return {
    items: rows.map((row) => ({ ...row, roles: roleMap.get(row.id) ?? [] })),
    total: Number(totalRow?.value ?? 0),
  };
}

/** Ganti seluruh role user di `user_roles` (dipakai di dalam transaksi). */
async function replaceUserRoles(
  tx: DbTransaction,
  userId: string,
  roleCodes: RoleCode[],
): Promise<void> {
  const uniqueCodes = [...new Set(roleCodes)];
  const roleRows = await tx
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(inArray(rolesTable.code, uniqueCodes));

  if (roleRows.length !== uniqueCodes.length) {
    throw ApiError.unprocessable("Ada role yang tidak dikenal.", { roleCodes });
  }

  await tx.delete(userRoles).where(eq(userRoles.userId, userId));
  await tx.insert(userRoles).values(roleRows.map((role) => ({ userId, roleId: role.id })));
}

/**
 * Buat user baru lewat plugin admin Better Auth (pendaftaran publik dimatikan),
 * lalu tetapkan role aplikasi + audit.
 */
export async function createUser(
  input: CreateUserInput,
  actorUserId: string,
  headers: Headers,
): Promise<ManagedUser> {
  const isAdmin = input.roleCodes.includes("ADMIN");
  let createdUserId: string;

  try {
    const created = await auth.api.createUser({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        // Penanda admin plugin Better Auth — disinkronkan dengan role ADMIN aplikasi.
        role: isAdmin ? "admin" : "user",
      },
      headers,
    });
    createdUserId = created.user.id;
  } catch (error) {
    if (betterAuthErrorCode(error) === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      throw ApiError.conflict("Email sudah digunakan oleh pengguna lain.", {
        fields: [{ path: "email", message: "Email sudah digunakan." }],
      });
    }
    throw error;
  }

  await db.transaction(async (tx) => {
    await replaceUserRoles(tx, createdUserId, input.roleCodes);
    await recordAudit(tx, {
      actorUserId,
      action: "user.create",
      entityType: "user",
      entityId: createdUserId,
      details: { email: input.email, roleCodes: input.roleCodes },
    });
  });

  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      banned: userTable.banned,
      banReason: userTable.banReason,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.id, createdUserId))
    .limit(1);

  if (!row) throw ApiError.notFound("Pengguna tidak ditemukan setelah dibuat.");
  return { ...row, roles: input.roleCodes };
}

/** Ubah nama pengguna. */
export async function updateUserName(
  userId: string,
  name: string,
  actorUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(userTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id });

    if (updated.length === 0) throw ApiError.notFound("Pengguna tidak ditemukan.");
    await recordAudit(tx, {
      actorUserId,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      details: { name },
    });
  });
}

/** Ganti seluruh role aplikasi pengguna + sinkronkan penanda admin Better Auth. */
export async function setUserRoles(
  userId: string,
  roleCodes: RoleCode[],
  actorUserId: string,
  headers: Headers,
): Promise<void> {
  const target = await getUserRow(userId);
  if (!target) throw ApiError.notFound("Pengguna tidak ditemukan.");

  if (target.id === actorUserId && !roleCodes.includes("ADMIN")) {
    throw ApiError.badRequest("Anda tidak dapat mencabut role Administrator dari akun sendiri.");
  }

  try {
    await auth.api.setRole({
      body: { userId, role: roleCodes.includes("ADMIN") ? "admin" : "user" },
      headers,
    });
  } catch (error) {
    if (betterAuthErrorCode(error) === "USER_NOT_FOUND") {
      throw ApiError.notFound("Pengguna tidak ditemukan.");
    }
    throw error;
  }

  await db.transaction(async (tx) => {
    await replaceUserRoles(tx, userId, roleCodes);
    await recordAudit(tx, {
      actorUserId,
      action: "user.roles.assign",
      entityType: "user",
      entityId: userId,
      details: { email: target.email, roleCodes },
    });
  });
}

/** Reset password pengguna (oleh Administrator). */
export async function setUserPassword(
  userId: string,
  newPassword: string,
  actorUserId: string,
  headers: Headers,
): Promise<void> {
  const target = await getUserRow(userId);
  if (!target) throw ApiError.notFound("Pengguna tidak ditemukan.");

  await auth.api.setUserPassword({
    body: { userId, newPassword },
    headers,
  });

  await recordAudit(db, {
    actorUserId,
    action: "user.password.reset",
    entityType: "user",
    entityId: userId,
    details: { email: target.email },
  });
}

/** Nonaktifkan (ban) atau aktifkan kembali pengguna. */
export async function setUserBanned(
  userId: string,
  banned: boolean,
  reason: string | undefined,
  actorUserId: string,
  headers: Headers,
): Promise<void> {
  const target = await getUserRow(userId);
  if (!target) throw ApiError.notFound("Pengguna tidak ditemukan.");

  if (banned && userId === actorUserId) {
    throw ApiError.badRequest("Anda tidak dapat menonaktifkan akun sendiri.");
  }

  if (banned) {
    await auth.api.banUser({
      body: { userId, banReason: reason ?? "Dinonaktifkan oleh Administrator" },
      headers,
    });
  } else {
    await auth.api.unbanUser({ body: { userId }, headers });
  }

  await recordAudit(db, {
    actorUserId,
    action: banned ? "user.deactivate" : "user.activate",
    entityType: "user",
    entityId: userId,
    details: { email: target.email, reason: reason ?? null },
  });
}

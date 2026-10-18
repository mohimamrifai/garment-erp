import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { warehouseLocations, warehouses } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nullable } from "@/lib/utils/strings";
import type {
  ListWarehousesQuery,
  LocationFormInput,
  UpdateLocationInput,
  UpdateWarehouseInput,
  WarehouseFormInput,
} from "./schemas";

export type Warehouse = typeof warehouses.$inferSelect;
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;

export type WarehouseListRow = Warehouse & { locationCount: number };

export async function listWarehouses(
  params: ListWarehousesQuery,
): Promise<{ items: WarehouseListRow[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(warehouses.code, pattern),
        ilike(warehouses.name, pattern),
        ilike(warehouses.address, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(warehouses.isActive, true));
  if (params.status === "inactive") conditions.push(eq(warehouses.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(warehouses).where(where);
  const items = await db
    .select({
      id: warehouses.id,
      code: warehouses.code,
      name: warehouses.name,
      address: warehouses.address,
      isActive: warehouses.isActive,
      createdAt: warehouses.createdAt,
      updatedAt: warehouses.updatedAt,
      locationCount: count(warehouseLocations.id),
    })
    .from(warehouses)
    .leftJoin(warehouseLocations, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(where)
    .groupBy(warehouses.id)
    .orderBy(asc(warehouses.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: items.map((row) => ({ ...row, locationCount: Number(row.locationCount) })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function getWarehouseById(warehouseId: string): Promise<Warehouse> {
  const [warehouse] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1);
  if (!warehouse) throw ApiError.notFound("Gudang tidak ditemukan.");
  return warehouse;
}

export async function listLocations(warehouseId: string): Promise<WarehouseLocation[]> {
  return db
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.warehouseId, warehouseId))
    .orderBy(asc(warehouseLocations.code));
}

/** Opsi gudang aktif untuk dropdown transaksi (Fase 3+). */
export async function listWarehouseOptions(): Promise<{ id: string; code: string; name: string }[]> {
  return db
    .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.name));
}

function normalizeLocationCode(code: string): string {
  return code.trim().toUpperCase();
}

async function assertLocationCodeFree(
  tx: DbTransaction,
  warehouseId: string,
  code: string,
  excludeLocationId?: string,
): Promise<void> {
  const [duplicate] = await tx
    .select({ id: warehouseLocations.id })
    .from(warehouseLocations)
    .where(and(eq(warehouseLocations.warehouseId, warehouseId), eq(warehouseLocations.code, code)))
    .limit(1);
  if (duplicate && duplicate.id !== excludeLocationId) {
    throw ApiError.conflict(`Kode lokasi ${code} sudah dipakai di gudang ini.`);
  }
}

export async function createWarehouse(
  input: WarehouseFormInput,
  actorUserId: string,
): Promise<Warehouse> {
  return db.transaction(async (tx) => {
    const code = await nextDocumentNumber(tx, "WH", { period: null });
    const [warehouse] = await tx
      .insert(warehouses)
      .values({ code, name: input.name, address: nullable(input.address) })
      .returning();

    if (!warehouse) throw ApiError.badRequest("Gagal membuat gudang.");

    await recordAudit(tx, {
      actorUserId,
      action: "warehouse.create",
      entityType: "warehouse",
      entityId: warehouse.id,
      details: { code: warehouse.code, name: warehouse.name },
    });
    return warehouse;
  });
}

export async function updateWarehouse(
  warehouseId: string,
  input: UpdateWarehouseInput,
  actorUserId: string,
): Promise<Warehouse> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);
    if (!existing) throw ApiError.notFound("Gudang tidak ditemukan.");

    if (input.isActive === false && existing.isActive) {
      const [activeLocations] = await tx
        .select({ value: count() })
        .from(warehouseLocations)
        .where(
          and(eq(warehouseLocations.warehouseId, warehouseId), eq(warehouseLocations.isActive, true)),
        );
      if (Number(activeLocations?.value ?? 0) > 0) {
        throw ApiError.conflict(
          "Gudang masih memiliki lokasi aktif. Nonaktifkan lokasinya terlebih dahulu.",
        );
      }
    }

    const updates: Partial<typeof warehouses.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.address !== undefined) updates.address = nullable(input.address);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(warehouses)
      .set(updates)
      .where(eq(warehouses.id, warehouseId))
      .returning();

    if (!updated) throw ApiError.notFound("Gudang tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "warehouse.activate"
        : "warehouse.deactivate"
      : "warehouse.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "warehouse",
      entityId: warehouseId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}

export async function createLocation(
  warehouseId: string,
  input: LocationFormInput,
  actorUserId: string,
): Promise<WarehouseLocation> {
  return db.transaction(async (tx) => {
    const [warehouse] = await tx
      .select({ id: warehouses.id, code: warehouses.code })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);
    if (!warehouse) throw ApiError.notFound("Gudang tidak ditemukan.");

    const code = normalizeLocationCode(input.code);
    await assertLocationCodeFree(tx, warehouseId, code);

    let location: WarehouseLocation | undefined;
    try {
      [location] = await tx
        .insert(warehouseLocations)
        .values({ warehouseId, code, name: input.name })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(`Kode lokasi ${code} sudah dipakai di gudang ini.`);
      }
      throw error;
    }
    if (!location) throw ApiError.badRequest("Gagal membuat lokasi.");

    await recordAudit(tx, {
      actorUserId,
      action: "warehouse-location.create",
      entityType: "warehouse-location",
      entityId: location.id,
      details: { warehouseCode: warehouse.code, code: location.code, name: location.name },
    });
    return location;
  });
}

export async function updateLocation(
  locationId: string,
  input: UpdateLocationInput,
  actorUserId: string,
): Promise<WarehouseLocation> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(warehouseLocations)
      .where(eq(warehouseLocations.id, locationId))
      .limit(1);
    if (!existing) throw ApiError.notFound("Lokasi tidak ditemukan.");

    const updates: Partial<typeof warehouseLocations.$inferInsert> = {};
    if (input.code !== undefined) {
      const code = normalizeLocationCode(input.code);
      if (code !== existing.code) await assertLocationCodeFree(tx, existing.warehouseId, code, locationId);
      updates.code = code;
    }
    if (input.name !== undefined) updates.name = input.name;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    let updated: WarehouseLocation | undefined;
    try {
      [updated] = await tx
        .update(warehouseLocations)
        .set(updates)
        .where(eq(warehouseLocations.id, locationId))
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict("Kode lokasi bentrok dengan lokasi lain di gudang ini.");
      }
      throw error;
    }
    if (!updated) throw ApiError.notFound("Lokasi tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "warehouse-location.activate"
        : "warehouse-location.deactivate"
      : "warehouse-location.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "warehouse-location",
      entityId: locationId,
      details: { code: updated.code, changes: updates },
    });
    return updated;
  });
}

import { and, asc, count, eq, ilike, notInArray, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import {
  billsOfMaterials,
  productVariants,
  products,
  salesOrderItems,
  salesOrders,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nullable } from "@/lib/utils/strings";
import { FINAL_SO_STATUSES } from "@/modules/sales-order/status";
import type {
  ListProductsQuery,
  ProductFormInput,
  UpdateProductInput,
  UpdateVariantInput,
  VariantFormInput,
} from "./schemas";

export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;

export type ProductListRow = Product & { variantCount: number };

export type VariantOption = {
  id: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
};

/** Segmen SKU: huruf besar, spasi/simbol → tanda hubung. */
function toSkuSegment(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildVariantSku(productSku: string, size: string, color: string): string {
  return `${productSku}-${toSkuSegment(size)}-${toSkuSegment(color)}`;
}

export async function listProducts(
  params: ListProductsQuery,
): Promise<{ items: ProductListRow[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(products.sku, pattern), ilike(products.name, pattern), ilike(products.description, pattern)),
    );
  }
  if (params.status === "active") conditions.push(eq(products.isActive, true));
  if (params.status === "inactive") conditions.push(eq(products.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(products).where(where);
  const items = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      description: products.description,
      isActive: products.isActive,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      variantCount: count(productVariants.id),
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(where)
    .groupBy(products.id)
    .orderBy(asc(products.sku))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items: items.map((row) => ({ ...row, variantCount: Number(row.variantCount) })), total: Number(totalRow?.value ?? 0) };
}

export async function getProductById(productId: string): Promise<Product> {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw ApiError.notFound("Produk tidak ditemukan.");
  return product;
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.size), asc(productVariants.color));
}

/** Opsi varian aktif untuk sales order (produk harus aktif juga). */
export async function listVariantOptions(): Promise<VariantOption[]> {
  return db
    .select({
      id: productVariants.id,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.isActive, true), eq(products.isActive, true)))
    .orderBy(asc(products.name), asc(productVariants.size), asc(productVariants.color));
}

/** Guard: produk dipakai pada sales order yang belum final. */
async function assertProductUnused(tx: DbTransaction, productId: string): Promise<void> {
  const [used] = await tx
    .select({ value: count() })
    .from(salesOrderItems)
    .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .where(
      and(
        eq(productVariants.productId, productId),
        notInArray(salesOrders.status, [...FINAL_SO_STATUSES]),
      ),
    );
  if (Number(used?.value ?? 0) > 0) {
    throw ApiError.conflict("Produk dipakai pada sales order aktif. Selesaikan atau batalkan dulu.");
  }
}

/** Guard: varian dipakai pada sales order aktif atau BOM aktif. */
async function assertVariantUnused(tx: DbTransaction, variantId: string): Promise<void> {
  const [usedBySo] = await tx
    .select({ value: count() })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrderItems.salesOrderId, salesOrders.id))
    .where(
      and(
        eq(salesOrderItems.variantId, variantId),
        notInArray(salesOrders.status, [...FINAL_SO_STATUSES]),
      ),
    );
  if (Number(usedBySo?.value ?? 0) > 0) {
    throw ApiError.conflict("Varian dipakai pada sales order aktif. Selesaikan atau batalkan dulu.");
  }

  const [usedByBom] = await tx
    .select({ value: count() })
    .from(billsOfMaterials)
    .where(and(eq(billsOfMaterials.variantId, variantId), eq(billsOfMaterials.isActive, true)));
  if (Number(usedByBom?.value ?? 0) > 0) {
    throw ApiError.conflict("Varian dipakai pada BOM aktif. Nonaktifkan BOM terkait terlebih dahulu.");
  }
}

export async function createProduct(
  input: ProductFormInput,
  actorUserId: string,
): Promise<Product> {
  return db.transaction(async (tx) => {
    const sku = await nextDocumentNumber(tx, "PRD", { period: null });
    const [product] = await tx
      .insert(products)
      .values({ sku, name: input.name, description: nullable(input.description) })
      .returning();

    if (!product) throw ApiError.badRequest("Gagal membuat produk.");

    await recordAudit(tx, {
      actorUserId,
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
    });
    return product;
  });
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
  actorUserId: string,
): Promise<Product> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!existing) throw ApiError.notFound("Produk tidak ditemukan.");

    if (input.isActive === false && existing.isActive) {
      await assertProductUnused(tx, productId);
    }

    const updates: Partial<typeof products.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = nullable(input.description);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(products)
      .set(updates)
      .where(eq(products.id, productId))
      .returning();

    if (!updated) throw ApiError.notFound("Produk tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "product.activate"
        : "product.deactivate"
      : "product.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "product",
      entityId: productId,
      details: { sku: existing.sku, changes: updates },
    });
    return updated;
  });
}

export async function createVariant(
  productId: string,
  input: VariantFormInput,
  actorUserId: string,
): Promise<ProductVariant> {
  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw ApiError.notFound("Produk tidak ditemukan.");

    const size = input.size.trim();
    const color = input.color.trim();

    const [duplicate] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.size, size),
          eq(productVariants.color, color),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw ApiError.conflict(`Varian ${size}/${color} sudah ada pada produk ini.`);
    }

    const variantSku = buildVariantSku(product.sku, size, color);
    let variant: ProductVariant | undefined;
    try {
      [variant] = await tx
        .insert(productVariants)
        .values({ productId, size, color, variantSku })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict(`SKU varian ${variantSku} sudah dipakai.`);
      }
      throw error;
    }
    if (!variant) throw ApiError.badRequest("Gagal membuat varian.");

    await recordAudit(tx, {
      actorUserId,
      action: "product-variant.create",
      entityType: "product-variant",
      entityId: variant.id,
      details: { productSku: product.sku, variantSku: variant.variantSku, size, color },
    });
    return variant;
  });
}

export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput,
  actorUserId: string,
): Promise<ProductVariant> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        variant: productVariants,
        productSku: products.sku,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!existing) throw ApiError.notFound("Varian tidak ditemukan.");

    if (input.isActive === false && existing.variant.isActive) {
      await assertVariantUnused(tx, variantId);
    }

    const size = input.size !== undefined ? input.size.trim() : existing.variant.size;
    const color = input.color !== undefined ? input.color.trim() : existing.variant.color;
    const sizeColorChanged = size !== existing.variant.size || color !== existing.variant.color;

    if (sizeColorChanged) {
      const [duplicate] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, existing.variant.productId),
            eq(productVariants.size, size),
            eq(productVariants.color, color),
          ),
        )
        .limit(1);
      if (duplicate && duplicate.id !== variantId) {
        throw ApiError.conflict(`Varian ${size}/${color} sudah ada pada produk ini.`);
      }
    }

    const updates: Partial<typeof productVariants.$inferInsert> = {};
    if (input.size !== undefined) updates.size = size;
    if (input.color !== undefined) updates.color = color;
    if (sizeColorChanged) {
      updates.variantSku = buildVariantSku(existing.productSku, size, color);
    }
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    let updated: ProductVariant | undefined;
    try {
      [updated] = await tx
        .update(productVariants)
        .set(updates)
        .where(eq(productVariants.id, variantId))
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict("SKU varian bentrok dengan varian lain.");
      }
      throw error;
    }
    if (!updated) throw ApiError.notFound("Varian tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "product-variant.activate"
        : "product-variant.deactivate"
      : "product-variant.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "product-variant",
      entityId: variantId,
      details: { variantSku: updated.variantSku, changes: updates },
    });
    return updated;
  });
}

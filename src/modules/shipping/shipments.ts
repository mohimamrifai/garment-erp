import { eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  productVariants,
  salesOrderItems,
  shipmentItems,
  shipments,
  type Shipment,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "@/modules/inventory/engine";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import type { CancelShipmentInput, CreateShipmentInput } from "./schemas";
import {
  allocationRowsByItem,
  assertLocationActive,
  finishedGoodsBalances,
  lockSalesOrder,
  shippedQuantitiesByItem,
} from "./shared";
import {
  canCancelShipment,
  canCreateShipmentForOrder,
  maxShippableQuantity,
  remainingOrderQuantity,
} from "./status";
import { recalculateSalesOrderFulfillmentStatus } from "./fulfillment";

export async function createShipment(
  input: CreateShipmentInput,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const order = await lockSalesOrder(tx, input.salesOrderId);
    if (!canCreateShipmentForOrder(order.status)) {
      throw ApiError.conflict(
        `Sales order berstatus ${SO_STATUS_LABELS[order.status]} tidak dapat dikirim.`,
      );
    }
    const location = await assertLocationActive(tx, input.locationId);

    const orderItems = await tx
      .select({
        id: salesOrderItems.id,
        variantId: salesOrderItems.variantId,
        quantity: salesOrderItems.quantity,
        variantSku: productVariants.variantSku,
      })
      .from(salesOrderItems)
      .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
      .where(eq(salesOrderItems.salesOrderId, order.id));
    const itemById = new Map(orderItems.map((item) => [item.id, item]));

    const itemIds = input.items.map((item) => item.salesOrderItemId);
    const variantIds = [
      ...new Set(
        input.items
          .map((item) => itemById.get(item.salesOrderItemId)?.variantId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [shippedMap, allocations, balances] = await Promise.all([
      shippedQuantitiesByItem(tx, itemIds),
      allocationRowsByItem(tx, itemIds),
      finishedGoodsBalances(tx, variantIds),
    ]);

    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw ApiError.badRequest("Kuantitas pengiriman minimal 1.");
      }
      const item = itemById.get(line.salesOrderItemId);
      if (!item) {
        throw ApiError.badRequest("Ada item pengiriman yang bukan milik sales order ini.");
      }
      const shipped = shippedMap.get(item.id) ?? 0;
      const allocatedAtLocation = allocations
        .filter((row) => row.itemId === item.id && row.locationId === input.locationId)
        .reduce((sum, row) => sum + row.quantity, 0);
      const balance = balances.find(
        (row) => row.variantId === item.variantId && row.locationId === input.locationId,
      );
      const availableAtLocation = balance ? balance.onHand - balance.reserved : 0;
      const max = maxShippableQuantity({
        orderedQuantity: item.quantity,
        shippedQuantity: shipped,
        availableAtLocation,
        allocatedToItemAtLocation: allocatedAtLocation,
      });
      if (line.quantity > max) {
        throw ApiError.conflict(
          `Kuantitas pengiriman ${item.variantSku} melebihi batas (maksimal ${max} unit: sisa pesanan ${remainingOrderQuantity(item.quantity, shipped)}, tersedia di ${location.code} ${availableAtLocation + allocatedAtLocation}).`,
        );
      }
    }

    const number = await nextDocumentNumber(tx, "SJ");
    const [shipment] = await tx
      .insert(shipments)
      .values({
        number,
        salesOrderId: order.id,
        shippedAt: input.shippedAt,
        locationId: input.locationId,
        status: "DRAFT",
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!shipment) throw ApiError.badRequest("Gagal membuat pengiriman.");

    await tx.insert(shipmentItems).values(
      input.items.map((line) => ({
        shipmentId: shipment.id,
        salesOrderItemId: line.salesOrderItemId,
        variantId: itemById.get(line.salesOrderItemId)!.variantId,
        quantity: String(line.quantity),
        notes: nullable(line.notes),
      })),
    );

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.create",
      entityType: "shipment",
      entityId: shipment.id,
      details: {
        number,
        salesOrderNumber: order.number,
        location: `${location.warehouseName} / ${location.code}`,
        itemCount: input.items.length,
        totalQuantity: input.items.reduce((sum, line) => sum + line.quantity, 0),
      },
    });

    return shipment;
  });
}

export async function postShipment(
  shipmentId: string,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");
    if (!shipment) throw ApiError.notFound("Pengiriman tidak ditemukan.");
    if (shipment.status === "POSTED") {
      throw ApiError.conflict("Pengiriman ini sudah diposting.");
    }
    if (!canCancelShipment(shipment.status)) {
      throw ApiError.conflict("Pengiriman yang dibatalkan tidak dapat diposting.");
    }

    const order = await lockSalesOrder(tx, shipment.salesOrderId);
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("Sales order sudah dibatalkan; pengiriman tidak dapat diposting.");
    }

    const lines = await tx
      .select({
        id: shipmentItems.id,
        salesOrderItemId: shipmentItems.salesOrderItemId,
        variantId: shipmentItems.variantId,
        quantity: shipmentItems.quantity,
        variantSku: productVariants.variantSku,
        orderedQuantity: salesOrderItems.quantity,
      })
      .from(shipmentItems)
      .innerJoin(salesOrderItems, eq(shipmentItems.salesOrderItemId, salesOrderItems.id))
      .innerJoin(productVariants, eq(shipmentItems.variantId, productVariants.id))
      .where(eq(shipmentItems.shipmentId, shipment.id));
    if (lines.length === 0) {
      throw ApiError.badRequest("Pengiriman tidak memiliki item.");
    }

    const itemIds = lines.map((line) => line.salesOrderItemId);
    const variantIds = [...new Set(lines.map((line) => line.variantId))];
    const [shippedMap, allocations, balances] = await Promise.all([
      shippedQuantitiesByItem(tx, itemIds),
      allocationRowsByItem(tx, itemIds),
      finishedGoodsBalances(tx, variantIds),
    ]);

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const shipped = shippedMap.get(line.salesOrderItemId) ?? 0;
      const remaining = remainingOrderQuantity(line.orderedQuantity, shipped);
      if (quantity > remaining) {
        throw ApiError.conflict(
          `Sisa pesanan ${line.variantSku} hanya ${remaining} unit; tidak dapat mengirim ${quantity}.`,
        );
      }

      const allocatedAtLocation = allocations
        .filter(
          (row) => row.itemId === line.salesOrderItemId && row.locationId === shipment.locationId,
        )
        .reduce((sum, row) => sum + row.quantity, 0);
      const release = Math.min(quantity, allocatedAtLocation);
      const balance = balances.find(
        (row) => row.variantId === line.variantId && row.locationId === shipment.locationId,
      );
      const availableAtLocation = (balance ? balance.onHand - balance.reserved : 0) + release;
      if (quantity > availableAtLocation) {
        throw ApiError.conflict(
          `Stok barang jadi ${line.variantSku} di lokasi pengiriman tidak cukup (tersedia ${availableAtLocation} unit).`,
        );
      }

      if (release > 0) {
        await postMovement(tx, {
          itemType: "FINISHED_GOOD",
          variantId: line.variantId,
          transactionType: "UNRESERVE",
          quantity: release,
          fromLocationId: shipment.locationId,
          referenceType: "so-allocation",
          referenceId: line.salesOrderItemId,
          notes: `Pelepasan alokasi untuk pengiriman ${shipment.number}`,
          idempotencyKey: `shipment:${shipment.id}:unreserve:${line.id}`,
          postedBy: actorUserId,
        });
      }

      await postMovement(tx, {
        itemType: "FINISHED_GOOD",
        variantId: line.variantId,
        transactionType: "ISSUE",
        quantity,
        fromLocationId: shipment.locationId,
        referenceType: "shipment",
        referenceId: shipment.id,
        notes: `Pengiriman ${shipment.number} — ${order.number}`,
        idempotencyKey: `shipment:${shipment.id}:issue:${line.id}`,
        postedBy: actorUserId,
      });
    }

    const [updated] = await tx
      .update(shipments)
      .set({ status: "POSTED", postedAt: new Date(), postedBy: actorUserId })
      .where(eq(shipments.id, shipment.id))
      .returning();
    if (!updated) throw ApiError.badRequest("Gagal memposting pengiriman.");

    const recalculated = await recalculateSalesOrderFulfillmentStatus(tx, order.id);

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.post",
      entityType: "shipment",
      entityId: shipment.id,
      details: {
        number: shipment.number,
        salesOrderNumber: order.number,
        itemCount: lines.length,
        totalQuantity: lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        orderStatus: recalculated.status,
      },
    });

    return updated;
  });
}

export async function cancelShipment(
  shipmentId: string,
  input: CancelShipmentInput,
  actorUserId: string,
): Promise<Shipment> {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .for("update");
    if (!shipment) throw ApiError.notFound("Pengiriman tidak ditemukan.");
    if (!canCancelShipment(shipment.status)) {
      throw ApiError.conflict("Hanya pengiriman berstatus draf yang dapat dibatalkan.");
    }

    const [updated] = await tx
      .update(shipments)
      .set({
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledAt: new Date(),
      })
      .where(eq(shipments.id, shipment.id))
      .returning();
    if (!updated) throw ApiError.badRequest("Gagal membatalkan pengiriman.");

    await recordAudit(tx, {
      actorUserId,
      action: "shipment.cancel",
      entityType: "shipment",
      entityId: shipment.id,
      details: { number: shipment.number, reason: input.reason },
    });

    return updated;
  });
}

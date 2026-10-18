CREATE TYPE "public"."material_receipt_status" AS ENUM('DRAFT', 'POSTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_type" AS ENUM('MATERIAL', 'FINISHED_GOOD');--> statement-breakpoint
CREATE TYPE "public"."inventory_transaction_type" AS ENUM('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RESERVE', 'UNRESERVE');--> statement-breakpoint
CREATE TABLE "material_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"received_quantity" numeric(16, 4) NOT NULL,
	"accepted_quantity" numeric(16, 4) NOT NULL,
	"notes" text,
	CONSTRAINT "material_receipt_items_receipt_item_uq" UNIQUE("material_receipt_id","purchase_order_item_id"),
	CONSTRAINT "material_receipt_items_quantity_chk" CHECK ("material_receipt_items"."received_quantity" > 0 and "material_receipt_items"."accepted_quantity" >= 0 and "material_receipt_items"."accepted_quantity" <= "material_receipt_items"."received_quantity")
);
--> statement-breakpoint
CREATE TABLE "material_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"received_at" date NOT NULL,
	"location_id" uuid NOT NULL,
	"status" "material_receipt_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"cancel_reason" text,
	"posted_at" timestamp with time zone,
	"posted_by" text,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"ordered_quantity" numeric(16, 4) NOT NULL,
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	CONSTRAINT "purchase_order_items_order_material_uq" UNIQUE("purchase_order_id","material_id"),
	CONSTRAINT "purchase_order_items_quantity_chk" CHECK ("purchase_order_items"."ordered_quantity" > 0),
	CONSTRAINT "purchase_order_items_price_chk" CHECK ("purchase_order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date,
	"status" "purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"cancel_reason" text,
	"ordered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "purchase_orders_dates_chk" CHECK ("purchase_orders"."expected_date" is null or "purchase_orders"."expected_date" >= "purchase_orders"."order_date")
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type" "inventory_item_type" NOT NULL,
	"material_id" uuid,
	"variant_id" uuid,
	"location_id" uuid NOT NULL,
	"quantity_on_hand" numeric(16, 4) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(16, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_item_chk" CHECK (num_nonnulls("inventory_balances"."material_id", "inventory_balances"."variant_id") = 1),
	CONSTRAINT "inventory_balances_item_type_chk" CHECK (("inventory_balances"."item_type" = 'MATERIAL') = ("inventory_balances"."material_id" is not null)),
	CONSTRAINT "inventory_balances_on_hand_chk" CHECK ("inventory_balances"."quantity_on_hand" >= 0),
	CONSTRAINT "inventory_balances_reserved_chk" CHECK ("inventory_balances"."quantity_reserved" >= 0),
	CONSTRAINT "inventory_balances_reserved_le_on_hand_chk" CHECK ("inventory_balances"."quantity_reserved" <= "inventory_balances"."quantity_on_hand")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"item_type" "inventory_item_type" NOT NULL,
	"material_id" uuid,
	"variant_id" uuid,
	"transaction_type" "inventory_transaction_type" NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"reference_type" text,
	"reference_id" uuid,
	"notes" text,
	"idempotency_key" text,
	"posted_by" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_transactions_number_unique" UNIQUE("number"),
	CONSTRAINT "inventory_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "inventory_transactions_item_chk" CHECK (num_nonnulls("inventory_transactions"."material_id", "inventory_transactions"."variant_id") = 1),
	CONSTRAINT "inventory_transactions_item_type_chk" CHECK (("inventory_transactions"."item_type" = 'MATERIAL') = ("inventory_transactions"."material_id" is not null)),
	CONSTRAINT "inventory_transactions_quantity_chk" CHECK ("inventory_transactions"."quantity" > 0),
	CONSTRAINT "inventory_transactions_shape_chk" CHECK ((case "inventory_transactions"."transaction_type"
        when 'RECEIPT' then "inventory_transactions"."to_location_id" is not null and "inventory_transactions"."from_location_id" is null
        when 'ISSUE' then "inventory_transactions"."from_location_id" is not null and "inventory_transactions"."to_location_id" is null
        when 'TRANSFER' then "inventory_transactions"."from_location_id" is not null and "inventory_transactions"."to_location_id" is not null and "inventory_transactions"."from_location_id" <> "inventory_transactions"."to_location_id"
        when 'ADJUSTMENT_IN' then "inventory_transactions"."to_location_id" is not null and "inventory_transactions"."from_location_id" is null
        when 'ADJUSTMENT_OUT' then "inventory_transactions"."from_location_id" is not null and "inventory_transactions"."to_location_id" is null
        when 'RESERVE' then "inventory_transactions"."from_location_id" is not null and "inventory_transactions"."to_location_id" is null
        when 'UNRESERVE' then "inventory_transactions"."from_location_id" is not null and "inventory_transactions"."to_location_id" is null
      end))
);
--> statement-breakpoint
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_material_receipt_id_material_receipts_id_fk" FOREIGN KEY ("material_receipt_id") REFERENCES "public"."material_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_posted_by_user_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_location_id_warehouse_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_location_id_warehouse_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_posted_by_user_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_receipt_items_receipt_idx" ON "material_receipt_items" USING btree ("material_receipt_id");--> statement-breakpoint
CREATE INDEX "material_receipt_items_order_item_idx" ON "material_receipt_items" USING btree ("purchase_order_item_id");--> statement-breakpoint
CREATE INDEX "material_receipts_order_idx" ON "material_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "material_receipts_status_idx" ON "material_receipts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "material_receipts_received_at_idx" ON "material_receipts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "material_receipts_location_idx" ON "material_receipts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_order_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_material_idx" ON "purchase_order_items" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_orders_expected_date_idx" ON "purchase_orders" USING btree ("expected_date");--> statement-breakpoint
CREATE INDEX "inventory_balances_material_idx" ON "inventory_balances" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "inventory_balances_variant_idx" ON "inventory_balances" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_balances_location_idx" ON "inventory_balances" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_material_location_uq" ON "inventory_balances" USING btree ("material_id","location_id") WHERE "inventory_balances"."material_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_variant_location_uq" ON "inventory_balances" USING btree ("variant_id","location_id") WHERE "inventory_balances"."variant_id" is not null;--> statement-breakpoint
CREATE INDEX "inventory_transactions_material_idx" ON "inventory_transactions" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "inventory_transactions_variant_idx" ON "inventory_transactions" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "inventory_transactions_posted_at_idx" ON "inventory_transactions" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "inventory_transactions_reference_idx" ON "inventory_transactions" USING btree ("reference_type","reference_id");
CREATE TYPE "public"."shipment_status" AS ENUM('DRAFT', 'POSTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "finished_goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"production_order_id" uuid NOT NULL,
	"qc_inspection_id" uuid NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finished_goods_quantity_chk" CHECK ("finished_goods"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"sales_order_item_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"notes" text,
	CONSTRAINT "shipment_items_shipment_item_uq" UNIQUE("shipment_id","sales_order_item_id"),
	CONSTRAINT "shipment_items_quantity_chk" CHECK ("shipment_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"shipped_at" date NOT NULL,
	"location_id" uuid NOT NULL,
	"status" "shipment_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"cancel_reason" text,
	"posted_at" timestamp with time zone,
	"posted_by" text,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_qc_inspection_id_qc_inspections_id_fk" FOREIGN KEY ("qc_inspection_id") REFERENCES "public"."qc_inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_sales_order_item_id_sales_order_items_id_fk" FOREIGN KEY ("sales_order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_posted_by_user_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finished_goods_variant_idx" ON "finished_goods" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "finished_goods_location_idx" ON "finished_goods" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "finished_goods_order_idx" ON "finished_goods" USING btree ("production_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finished_goods_inspection_uq" ON "finished_goods" USING btree ("qc_inspection_id");--> statement-breakpoint
CREATE INDEX "shipment_items_shipment_idx" ON "shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_items_order_item_idx" ON "shipment_items" USING btree ("sales_order_item_id");--> statement-breakpoint
CREATE INDEX "shipment_items_variant_idx" ON "shipment_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipments_shipped_at_idx" ON "shipments" USING btree ("shipped_at");--> statement-breakpoint
CREATE INDEX "shipments_location_idx" ON "shipments" USING btree ("location_id");
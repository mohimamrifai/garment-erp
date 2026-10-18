CREATE TYPE "public"."production_order_status" AS ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."production_stage_code" AS ENUM('CUTTING', 'SEWING', 'FINISHING', 'PACKING');--> statement-breakpoint
CREATE TYPE "public"."production_stage_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."qc_result" AS ENUM('PENDING', 'PASS', 'FAIL', 'REWORK');--> statement-breakpoint
CREATE TABLE "material_issue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_issue_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"notes" text,
	CONSTRAINT "material_issue_items_issue_material_uq" UNIQUE("material_issue_id","material_id"),
	CONSTRAINT "material_issue_items_quantity_chk" CHECK ("material_issue_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "material_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"production_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"issued_at" date NOT NULL,
	"notes" text,
	"idempotency_key" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_issues_number_unique" UNIQUE("number"),
	CONSTRAINT "material_issues_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "production_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"sales_order_item_id" uuid NOT NULL,
	"bom_id" uuid NOT NULL,
	"production_line_id" uuid,
	"planned_quantity" integer NOT NULL,
	"planned_start_date" date NOT NULL,
	"planned_end_date" date NOT NULL,
	"status" "production_order_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text,
	"shortage_reason" text,
	"cancel_reason" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "production_orders_quantity_chk" CHECK ("production_orders"."planned_quantity" > 0),
	CONSTRAINT "production_orders_dates_chk" CHECK ("production_orders"."planned_end_date" >= "production_orders"."planned_start_date")
);
--> statement-breakpoint
CREATE TABLE "production_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_stage_id" uuid NOT NULL,
	"processed_quantity" integer NOT NULL,
	"passed_quantity" integer NOT NULL,
	"rejected_quantity" integer NOT NULL,
	"is_rework" boolean DEFAULT false NOT NULL,
	"notes" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_records_quantity_chk" CHECK ("production_records"."processed_quantity" > 0 and "production_records"."passed_quantity" >= 0 and "production_records"."rejected_quantity" >= 0 and "production_records"."passed_quantity" + "production_records"."rejected_quantity" = "production_records"."processed_quantity")
);
--> statement-breakpoint
CREATE TABLE "production_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_order_id" uuid NOT NULL,
	"stage_code" "production_stage_code" NOT NULL,
	"sequence_number" integer NOT NULL,
	"target_quantity" integer NOT NULL,
	"status" "production_stage_status" DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_stages_order_sequence_uq" UNIQUE("production_order_id","sequence_number"),
	CONSTRAINT "production_stages_order_code_uq" UNIQUE("production_order_id","stage_code"),
	CONSTRAINT "production_stages_sequence_chk" CHECK ("production_stages"."sequence_number" >= 1),
	CONSTRAINT "production_stages_target_chk" CHECK ("production_stages"."target_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "qc_defects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"defect_code" text NOT NULL,
	"defect_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"disposition" text,
	CONSTRAINT "qc_defects_quantity_chk" CHECK ("qc_defects"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "qc_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"production_stage_id" uuid NOT NULL,
	"inspected_quantity" integer NOT NULL,
	"passed_quantity" integer NOT NULL,
	"rejected_quantity" integer NOT NULL,
	"result" "qc_result" DEFAULT 'PENDING' NOT NULL,
	"parent_inspection_id" uuid,
	"notes" text,
	"inspected_by" text,
	"inspected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qc_inspections_number_unique" UNIQUE("number"),
	CONSTRAINT "qc_inspections_quantity_chk" CHECK ("qc_inspections"."inspected_quantity" > 0 and "qc_inspections"."passed_quantity" >= 0 and "qc_inspections"."rejected_quantity" >= 0 and "qc_inspections"."passed_quantity" + "qc_inspections"."rejected_quantity" <= "qc_inspections"."inspected_quantity")
);
--> statement-breakpoint
ALTER TABLE "material_issue_items" ADD CONSTRAINT "material_issue_items_material_issue_id_material_issues_id_fk" FOREIGN KEY ("material_issue_id") REFERENCES "public"."material_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_issue_items" ADD CONSTRAINT "material_issue_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_item_id_sales_order_items_id_fk" FOREIGN KEY ("sales_order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_bills_of_materials_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bills_of_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_production_line_id_production_lines_id_fk" FOREIGN KEY ("production_line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_production_stage_id_production_stages_id_fk" FOREIGN KEY ("production_stage_id") REFERENCES "public"."production_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_defects" ADD CONSTRAINT "qc_defects_inspection_id_qc_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."qc_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_production_stage_id_production_stages_id_fk" FOREIGN KEY ("production_stage_id") REFERENCES "public"."production_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_parent_inspection_id_qc_inspections_id_fk" FOREIGN KEY ("parent_inspection_id") REFERENCES "public"."qc_inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_inspected_by_user_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_issue_items_issue_idx" ON "material_issue_items" USING btree ("material_issue_id");--> statement-breakpoint
CREATE INDEX "material_issue_items_material_idx" ON "material_issue_items" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "material_issues_order_idx" ON "material_issues" USING btree ("production_order_id");--> statement-breakpoint
CREATE INDEX "material_issues_issued_at_idx" ON "material_issues" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "production_orders_so_item_idx" ON "production_orders" USING btree ("sales_order_item_id");--> statement-breakpoint
CREATE INDEX "production_orders_status_idx" ON "production_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "production_orders_planned_end_idx" ON "production_orders" USING btree ("planned_end_date");--> statement-breakpoint
CREATE INDEX "production_records_stage_idx" ON "production_records" USING btree ("production_stage_id");--> statement-breakpoint
CREATE INDEX "production_stages_order_idx" ON "production_stages" USING btree ("production_order_id");--> statement-breakpoint
CREATE INDEX "qc_defects_inspection_idx" ON "qc_defects" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "qc_inspections_stage_idx" ON "qc_inspections" USING btree ("production_stage_id");--> statement-breakpoint
CREATE INDEX "qc_inspections_result_idx" ON "qc_inspections" USING btree ("result");--> statement-breakpoint
CREATE INDEX "qc_inspections_parent_idx" ON "qc_inspections" USING btree ("parent_inspection_id");
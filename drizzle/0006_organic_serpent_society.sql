CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_category" AS ENUM('OPERATING', 'INVESTING', 'FINANCING');--> statement-breakpoint
CREATE TYPE "public"."document_payment_status" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."fiscal_period_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."journal_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."normal_balance" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."payment_party_type" AS ENUM('BUYER', 'SUPPLIER', 'EMPLOYEE');--> statement-breakpoint
CREATE TYPE "public"."payment_reference_type" AS ENUM('SALES_INVOICE', 'PURCHASE_BILL', 'PAYROLL_RUN');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('RECEIPT', 'PAYMENT');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" text DEFAULT 'PRESENT' NOT NULL,
	"check_in" text,
	"check_out" text,
	"overtime_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_employee_date_uq" UNIQUE("employee_id","attendance_date"),
	CONSTRAINT "attendance_records_status_chk" CHECK ("attendance_records"."status" in ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'SICK', 'HOLIDAY')),
	CONSTRAINT "attendance_records_overtime_chk" CHECK ("attendance_records"."overtime_hours" >= 0 and "attendance_records"."overtime_hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_number_unique" UNIQUE("number"),
	CONSTRAINT "leave_requests_dates_chk" CHECK ("leave_requests"."end_date" >= "leave_requests"."start_date"),
	CONSTRAINT "leave_requests_days_chk" CHECK ("leave_requests"."days" > 0),
	CONSTRAINT "leave_requests_status_chk" CHECK ("leave_requests"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"max_days_per_year" integer DEFAULT 12 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code"),
	CONSTRAINT "leave_types_max_days_chk" CHECK ("leave_types"."max_days_per_year" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"period" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"total_gross" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_net" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_employer_contributions" numeric(16, 2) DEFAULT '0' NOT NULL,
	"journal_entry_id" uuid,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"payment_account_id" uuid,
	"cancel_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_runs_number_unique" UNIQUE("number"),
	CONSTRAINT "payroll_runs_period_chk" CHECK ("payroll_runs"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payroll_runs_dates_chk" CHECK ("payroll_runs"."end_date" >= "payroll_runs"."start_date"),
	CONSTRAINT "payroll_runs_status_chk" CHECK ("payroll_runs"."status" in ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')),
	CONSTRAINT "payroll_runs_totals_chk" CHECK ("payroll_runs"."total_gross" >= 0 and "payroll_runs"."total_deductions" >= 0 and "payroll_runs"."total_net" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_code" text NOT NULL,
	"employee_name" text NOT NULL,
	"department_name" text NOT NULL,
	"job_title" text NOT NULL,
	"bank_name" text,
	"bank_account_number" text,
	"basic_salary" numeric(16, 2) DEFAULT '0' NOT NULL,
	"fixed_allowance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"overtime_pay" numeric(16, 2) DEFAULT '0' NOT NULL,
	"gross" numeric(16, 2) DEFAULT '0' NOT NULL,
	"unpaid_leave_deduction" numeric(16, 2) DEFAULT '0' NOT NULL,
	"bpjs_kesehatan_employee" numeric(16, 2) DEFAULT '0' NOT NULL,
	"bpjs_jht_employee" numeric(16, 2) DEFAULT '0' NOT NULL,
	"bpjs_jp_employee" numeric(16, 2) DEFAULT '0' NOT NULL,
	"pph21" numeric(16, 2) DEFAULT '0' NOT NULL,
	"other_deductions" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net" numeric(16, 2) DEFAULT '0' NOT NULL,
	"employer_bpjs_kesehatan" numeric(16, 2) DEFAULT '0' NOT NULL,
	"employer_bpjs_jht" numeric(16, 2) DEFAULT '0' NOT NULL,
	"employer_bpjs_jp" numeric(16, 2) DEFAULT '0' NOT NULL,
	"employer_jkk" numeric(16, 2) DEFAULT '0' NOT NULL,
	"employer_jkm" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_employer_contributions" numeric(16, 2) DEFAULT '0' NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_run_employee_uq" UNIQUE("payroll_run_id","employee_id"),
	CONSTRAINT "payslips_amounts_chk" CHECK ("payslips"."gross" >= 0 and "payslips"."total_deductions" >= 0 and "payslips"."net" >= 0)
);
--> statement-breakpoint
CREATE TABLE "account_mappings" (
	"key" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"ppn_rate" numeric(5, 2) DEFAULT '11' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_settings_ppn_chk" CHECK ("accounting_settings"."ppn_rate" >= 0 and "accounting_settings"."ppn_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"normal_balance" "normal_balance" NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_cash_bank" boolean DEFAULT false NOT NULL,
	"bank_name" text,
	"account_number" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_unique" UNIQUE("code"),
	CONSTRAINT "accounts_code_chk" CHECK (length(trim("accounts"."code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "fiscal_period_status" DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_periods_year_month_uq" UNIQUE("year","month"),
	CONSTRAINT "fiscal_periods_month_chk" CHECK ("fiscal_periods"."month" between 1 and 12),
	CONSTRAINT "fiscal_periods_dates_chk" CHECK ("fiscal_periods"."end_date" >= "fiscal_periods"."start_date")
);
--> statement-breakpoint
CREATE TABLE "inventory_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type" text NOT NULL,
	"material_id" uuid,
	"variant_id" uuid,
	"quantity_on_hand" numeric(16, 4) DEFAULT '0' NOT NULL,
	"total_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"average_cost" numeric(18, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_costs_item_chk" CHECK (num_nonnulls("inventory_costs"."material_id", "inventory_costs"."variant_id") = 1),
	CONSTRAINT "inventory_costs_item_type_chk" CHECK (("inventory_costs"."item_type" = 'MATERIAL') = ("inventory_costs"."material_id" is not null)),
	CONSTRAINT "inventory_costs_quantity_chk" CHECK ("inventory_costs"."quantity_on_hand" >= 0),
	CONSTRAINT "inventory_costs_value_chk" CHECK ("inventory_costs"."total_value" >= 0 and "inventory_costs"."average_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"journal_date" date NOT NULL,
	"period_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" "journal_status" DEFAULT 'DRAFT' NOT NULL,
	"cash_flow_category" "cash_flow_category" DEFAULT 'OPERATING' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"source_event" text DEFAULT 'post' NOT NULL,
	"reversal_of_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_number_unique" UNIQUE("number"),
	CONSTRAINT "journal_entries_source_uq" UNIQUE("source_type","source_id","source_event"),
	CONSTRAINT "journal_entries_source_chk" CHECK (length(trim("journal_entries"."source_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_lines_amount_chk" CHECK ("journal_lines"."debit" >= 0 and "journal_lines"."credit" >= 0 and ("journal_lines"."debit" = 0 or "journal_lines"."credit" = 0) and ("journal_lines"."debit" + "journal_lines"."credit") > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"type" "payment_type" NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"account_id" uuid NOT NULL,
	"reference_type" "payment_reference_type" NOT NULL,
	"reference_id" uuid NOT NULL,
	"party_type" "payment_party_type",
	"party_id" uuid,
	"notes" text,
	"journal_entry_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_number_unique" UNIQUE("number"),
	CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	CONSTRAINT "purchase_bill_items_qty_chk" CHECK ("purchase_bill_items"."quantity" > 0 and "purchase_bill_items"."unit_price" >= 0 and "purchase_bill_items"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"material_receipt_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "document_payment_status" DEFAULT 'UNPAID' NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(18, 2) DEFAULT '0' NOT NULL,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_bills_number_unique" UNIQUE("number"),
	CONSTRAINT "purchase_bills_receipt_uq" UNIQUE("material_receipt_id"),
	CONSTRAINT "purchase_bills_amount_chk" CHECK ("purchase_bills"."subtotal" >= 0 and "purchase_bills"."tax_amount" >= 0 and "purchase_bills"."total" >= 0 and "purchase_bills"."amount_paid" >= 0 and "purchase_bills"."amount_paid" <= "purchase_bills"."total"),
	CONSTRAINT "purchase_bills_dates_chk" CHECK ("purchase_bills"."due_date" >= "purchase_bills"."bill_date")
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sales_order_item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(16, 4) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	CONSTRAINT "sales_invoice_items_qty_chk" CHECK ("sales_invoice_items"."quantity" > 0 and "sales_invoice_items"."unit_price" >= 0 and "sales_invoice_items"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"shipment_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "document_payment_status" DEFAULT 'UNPAID' NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(18, 2) DEFAULT '0' NOT NULL,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "sales_invoices_shipment_uq" UNIQUE("shipment_id"),
	CONSTRAINT "sales_invoices_amount_chk" CHECK ("sales_invoices"."subtotal" >= 0 and "sales_invoices"."tax_amount" >= 0 and "sales_invoices"."total" >= 0 and "sales_invoices"."amount_paid" >= 0 and "sales_invoices"."amount_paid" <= "sales_invoices"."total"),
	CONSTRAINT "sales_invoices_dates_chk" CHECK ("sales_invoices"."due_date" >= "sales_invoices"."invoice_date")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "join_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" text DEFAULT 'PERMANENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "contract_start_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "contract_end_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "resign_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "basic_salary" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "fixed_allowance" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "npwp" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bpjs_kesehatan_number" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bpjs_ketenagakerjaan_number" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "tax_status" text DEFAULT 'TK/0' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_issues" ADD COLUMN "total_cost" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_orders" ADD COLUMN "material_cost" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD COLUMN "unit_cost" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD COLUMN "total_cost" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_costs" ADD CONSTRAINT "inventory_costs_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_costs" ADD CONSTRAINT "inventory_costs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_journal_entries_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_user_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_bill_id_purchase_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_material_receipt_id_material_receipts_id_fk" FOREIGN KEY ("material_receipt_id") REFERENCES "public"."material_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_records_employee_idx" ON "attendance_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "attendance_records_date_idx" ON "attendance_records" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_records_status_idx" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_dates_idx" ON "leave_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "payroll_runs_period_idx" ON "payroll_runs" USING btree ("period");--> statement-breakpoint
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_period_active_uq" ON "payroll_runs" USING btree ("period") WHERE "payroll_runs"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "payslips_run_idx" ON "payslips" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "payslips_employee_idx" ON "payslips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "account_mappings_account_idx" ON "account_mappings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "accounts_parent_idx" ON "accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "fiscal_periods_status_idx" ON "fiscal_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_costs_material_idx" ON "inventory_costs" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "inventory_costs_variant_idx" ON "inventory_costs" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_costs_material_uq" ON "inventory_costs" USING btree ("material_id") WHERE "inventory_costs"."material_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_costs_variant_uq" ON "inventory_costs" USING btree ("variant_id") WHERE "inventory_costs"."variant_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("journal_date");--> statement-breakpoint
CREATE INDEX "journal_entries_period_idx" ON "journal_entries" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_reference_idx" ON "payments" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "payments_account_idx" ON "payments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "purchase_bill_items_bill_idx" ON "purchase_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "purchase_bills_supplier_idx" ON "purchase_bills" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_bills_status_idx" ON "purchase_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_bills_due_date_idx" ON "purchase_bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_invoice_idx" ON "sales_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_buyer_idx" ON "sales_invoices" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_status_idx" ON "sales_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_invoices_due_date_idx" ON "sales_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("employment_status");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_type_chk" CHECK ("employees"."employment_type" in ('PERMANENT', 'CONTRACT', 'DAILY'));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tax_status_chk" CHECK ("employees"."tax_status" in ('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_basic_salary_chk" CHECK ("employees"."basic_salary" >= 0);--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_fixed_allowance_chk" CHECK ("employees"."fixed_allowance" >= 0);--> statement-breakpoint
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_total_cost_chk" CHECK ("material_issues"."total_cost" >= 0);--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_material_cost_chk" CHECK ("production_orders"."material_cost" >= 0);--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_cost_chk" CHECK ("finished_goods"."unit_cost" >= 0 and "finished_goods"."total_cost" >= 0);
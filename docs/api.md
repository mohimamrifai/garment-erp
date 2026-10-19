# API Garment ERP (v1)

Semua endpoint aplikasi berada di bawah `/api/v1`. Autentikasi memakai sesi cookie
Better Auth; halaman dan API membaca sesi yang sama.

## 1. Konvensi

- **Autentikasi:** cookie sesi Better Auth (dibuat oleh `POST /api/auth/sign-in/email`).
  Request tanpa sesi yang valid → `401`.
- **Otorisasi:** RBAC per endpoint (`src/lib/permissions.ts`). Role tanpa izin → `403`.
- **Format sukses:** `{ "data": ..., "meta"?: ... }`
- **Format error:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`
- **Pagination:** query `page` (default 1), `pageSize` (default 10, maks 100); `meta` berisi
  `page`, `pageSize`, `total`, `totalPages`.
- **Tanggal:** string ISO `YYYY-MM-DD`; waktu pada respons ISO 8601 UTC.
- **Angka uang/kuantitas:** string desimal atau number sesuai kolom (dokumentasi menandai bila string).
- **Idempotency:** endpoint mutasi stok/postable menerima `idempotencyKey` opsional (min 8 karakter);
  request dengan key sama tidak menggandakan mutasi.

### Kode error

| HTTP | `code` | Arti |
|---|---|---|
| 400 | `BAD_REQUEST` | Permintaan tidak valid (relasi/urutan aksi salah, body bukan JSON). |
| 401 | `UNAUTHENTICATED` | Belum masuk / sesi tidak valid. |
| 403 | `FORBIDDEN` | Role tidak memiliki izin. |
| 404 | `NOT_FOUND` | Dokumen tidak ditemukan (termasuk ID bukan UUID). |
| 409 | `CONFLICT` | Melanggar aturan status/kuantitas/saldo (mis. melebihi sisa, sudah diposting). |
| 422 | `VALIDATION_ERROR` | Gagal validasi Zod; `details.fields[]` berisi path + pesan Bahasa Indonesia. |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga (detail hanya di log server). |

## 2. Autentikasi (Better Auth)

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/auth/sign-in/email` | Masuk dengan email + password. |
| POST | `/api/auth/sign-out` | Mengakhiri sesi. |
| GET | `/api/auth/get-session` | Sesi aktif (dipakai klien). |

Contoh:

```bash
curl -c cookie.txt -X POST https://<host>/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@garment.local","password":"password123"}'
```

```json
{
  "redirect": false,
  "token": "<token-sesi>",
  "user": { "id": "<uuid>", "email": "admin@garment.local", "name": "Administrator" }
}
```

## 3. Daftar endpoint per modul

Kolom **izin** adalah permission yang dicek `requireApiPermission()`.

### 3.1 Buyer

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/buyers` | `buyer.view` |
| POST | `/api/v1/buyers` | `buyer.create` |
| PATCH | `/api/v1/buyers/{id}` | `buyer.update` |

Body create/update: `name` (wajib), `contactPerson`, `phone`, `email`, `address`, `notes`;
update menerima `isActive` (nonaktifkan = `false`, bukan hapus permanen).

```bash
curl -b cookie.txt -X POST http://localhost:3000/api/v1/buyers \
  -H 'Content-Type: application/json' \
  -d '{"name":"PT Contoh Garmen","contactPerson":"Budi","phone":"021-123456"}'
```

### 3.2 Sales order & pemenuhan

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/sales-orders?query=&status=&page=&pageSize=` | `so.view` |
| POST | `/api/v1/sales-orders` | `so.create` |
| GET | `/api/v1/sales-orders/{id}` | `so.view` |
| PATCH | `/api/v1/sales-orders/{id}` | `so.update` (khusus draf) |
| POST | `/api/v1/sales-orders/{id}/confirm` | `so.confirm` |
| POST | `/api/v1/sales-orders/{id}/cancel` | `so.cancel` (alasan wajib) |
| GET | `/api/v1/sales-orders/{id}/fulfillment` | `so.view` |
| POST | `/api/v1/sales-orders/{id}/allocations` | `fg.allocate` |
| POST | `/api/v1/sales-orders/{id}/allocations/release` | `fg.allocate` |

Body create:

```json
{
  "buyerId": "<uuid>",
  "orderDate": "2026-10-19",
  "dueDate": "2026-11-02",
  "notes": "Catatan opsional",
  "items": [
    { "variantId": "<uuid>", "quantity": 30, "unitPrice": 210000 }
  ]
}
```

Body alokasi: `{ "salesOrderItemId": "<uuid>", "locationId": "<uuid>", "quantity": 10, "idempotencyKey": "opsional" }`.
Body pelepasan alokasi menambahkan `reason` opsional.

Contoh respons detail (diringkas):

```json
{
  "data": {
    "order": { "id": "<uuid>", "number": "SO-202610-0003", "status": "PARTIALLY_SHIPPED", "orderDate": "2026-10-07", "dueDate": "2026-10-18" },
    "buyer": { "id": "<uuid>", "code": "BUY-0003", "name": "Global Apparel Trading Pte Ltd" },
    "items": [
      { "id": "<uuid>", "variantSku": "PRD-0003-M-HITAM", "quantity": 30, "unitPrice": "210000.00", "shippedQuantity": 8 }
    ],
    "totals": { "itemCount": 1, "totalQuantity": 30, "shippedQuantity": 8, "totalValue": "6300000.00" }
  }
}
```

### 3.3 Pembelian & penerimaan

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/purchase-orders` | `po.view` |
| POST | `/api/v1/purchase-orders` | `po.create` |
| GET | `/api/v1/purchase-orders/{id}` | `po.view` |
| PATCH | `/api/v1/purchase-orders/{id}` | `po.update` (khusus draf) |
| POST | `/api/v1/purchase-orders/{id}/order` | `po.order` |
| POST | `/api/v1/purchase-orders/{id}/cancel` | `po.cancel` |
| GET | `/api/v1/material-receipts?query=&status=&po=` | `receipt.view` |
| POST | `/api/v1/material-receipts` | `receipt.create` |
| GET | `/api/v1/material-receipts/{id}` | `receipt.view` |
| PATCH | `/api/v1/material-receipts/{id}` | `receipt.update` (khusus draf) |
| POST | `/api/v1/material-receipts/{id}/post` | `receipt.post` |
| POST | `/api/v1/material-receipts/{id}/cancel` | `receipt.cancel` |

Body PO:

```json
{
  "supplierId": "<uuid>",
  "orderDate": "2026-10-19",
  "expectedDate": "2026-10-29",
  "items": [{ "materialId": "<uuid>", "orderedQuantity": 150, "unitPrice": 92000, "notes": "" }]
}
```

Body penerimaan (posting menambah stok material lewat inventory engine):

```json
{
  "purchaseOrderId": "<uuid>",
  "receivedAt": "2026-10-19",
  "locationId": "<uuid>",
  "notes": "Surat jalan GJ-2214",
  "items": [
    { "purchaseOrderItemId": "<uuid>", "receivedQuantity": 90, "acceptedQuantity": 80, "notes": "10 kg warna tidak sesuai" }
  ]
}
```

### 3.4 Inventori

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/inventory/balances?query=&warehouse=&location=&itemType=&low=` | `inventory.view` |
| GET | `/api/v1/inventory/transactions?type=&itemType=&location=&from=&to=` | `inventory.view` |
| POST | `/api/v1/inventory/transfers` | `inventory.move` |
| POST | `/api/v1/inventory/adjustments` | `inventory.adjust` |

Transfer:

```json
{
  "itemType": "MATERIAL",
  "materialId": "<uuid>",
  "variantId": "",
  "fromLocationId": "<uuid>",
  "toLocationId": "<uuid>",
  "quantity": 30,
  "notes": "Pindah untuk jadwal potong",
  "idempotencyKey": "transfer-20261019-01"
}
```

Penyesuaian: `direction` (`IN`/`OUT`), `reason` (min 3 karakter), sisanya sama seperti transfer.

> Semua perubahan saldo hanya lewat inventory engine; tidak ada endpoint yang menulis
> `inventory_balances` secara langsung.

### 3.5 Produksi

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/production-orders?query=&status=&line=` | `production.view` |
| POST | `/api/v1/production-orders` | `production.create` |
| GET | `/api/v1/production-orders/{id}` | `production.view` |
| POST | `/api/v1/production-orders/{id}/records` | `production.record` |
| POST | `/api/v1/production-orders/{id}/issues` | `production.issue` |
| POST | `/api/v1/production-orders/{id}/cancel` | `production.cancel` |
| GET | `/api/v1/production/planning?soItem=&quantity=&needBy=` | `production.view` |

Body SPK:

```json
{
  "salesOrderItemId": "<uuid>",
  "plannedQuantity": 15,
  "productionLineId": "<uuid>",
  "plannedStartDate": "2026-10-19",
  "plannedEndDate": "2026-10-24",
  "shortageReason": "Isi bila tetap dijalankan meski material kurang",
  "notes": ""
}
```

Body output tahap: `{ "stageCode": "CUTTING", "processedQuantity": 15, "passedQuantity": 14, "rejectedQuantity": 1, "isRework": false, "notes": "" }`
(variabel `passed + rejected = processed`).

Body pemakaian material:

```json
{
  "locationId": "<uuid>",
  "issuedAt": "2026-10-19",
  "idempotencyKey": "issue-spk-1",
  "items": [{ "materialId": "<uuid>", "quantity": 15.5, "notes": "" }]
}
```

### 3.6 Quality Control

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/qc-inspections?query=&result=&stage=` | `qc.view` |
| POST | `/api/v1/qc-inspections` | `qc.inspect` |
| GET | `/api/v1/qc-inspections/{id}` | `qc.view` |

Body inspeksi:

```json
{
  "productionStageId": "<uuid>",
  "parentInspectionId": "",
  "inspectedQuantity": 14,
  "passedQuantity": 13,
  "rejectedQuantity": 1,
  "result": "REWORK",
  "notes": "Potongan miring",
  "defects": [
    { "defectCode": "CUT-01", "defectName": "Potongan miring", "quantity": 1, "disposition": "Rework" }
  ]
}
```

> Inspeksi `PASS` pada tahap `PACKING` otomatis membuat lot barang jadi (movement
> `RECEIPT` idempotent `fg:<inspectionId>`).

### 3.7 Barang jadi & alokasi

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/finished-goods?query=&warehouse=&location=` | `fg.view` |

Respons berisi stok per varian/lokasi (`quantityOnHand`, `quantityReserved`),
`locationId`, ringkasan `totals.onHand/available/variantCount`, serta lot terbaru
(traceability ke SPK + inspeksi QC).

### 3.8 Pengiriman

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/shipments?query=&status=` | `shipment.view` |
| POST | `/api/v1/shipments` | `shipment.create` |
| GET | `/api/v1/shipments/{id}` | `shipment.view` |
| POST | `/api/v1/shipments/{id}/post` | `shipment.post` |
| POST | `/api/v1/shipments/{id}/cancel` | `shipment.cancel` |

Body buat surat jalan:

```json
{
  "salesOrderId": "<uuid>",
  "locationId": "<uuid>",
  "shippedAt": "2026-10-19",
  "notes": "Sebagian pesanan, sisa menyusul",
  "items": [{ "salesOrderItemId": "<uuid>", "quantity": 8, "notes": "" }]
}
```

Aturan: kuantitas ≤ sisa pesanan dan ≤ ketersediaan di lokasi (termasuk alokasi);
posting melepas alokasi lalu mengeluarkan stok lewat inventory engine; pembatalan
hanya untuk status `DRAFT`.

### 3.9 Laporan

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/reports/export?report=<slug>&from=&to=` | `report.view` + role laporan |

Slug: `sales-fulfillment`, `purchase-receipts`, `inventory-movements`,
`production-output`, `production-attainment`, `qc-defects`, `fg-shipments`.
Respons `text/csv` (RFC 4180 + BOM UTF-8), `Content-Disposition: attachment`.

```bash
curl -b cookie.txt -OJ 'http://localhost:3000/api/v1/reports/export?report=sales-fulfillment&from=2026-09-20&to=2026-10-19'
```

### 3.10 Master data

Pola seragam: `GET` (daftar) + `POST` (buat) pada koleksi, `PATCH /{id}` untuk ubah
(nonaktifkan memakai `isActive: false`).

| Submodul | Koleksi | Izin |
|---|---|---|
| Departemen | `/api/v1/master/departments` | `master.organization.view` / `.manage` |
| Karyawan | `/api/v1/master/employees` | `master.organization.view` / `.manage` |
| Lini produksi | `/api/v1/master/lines` | `master.organization.view` / `.manage` |
| Material | `/api/v1/master/materials` | `master.material.view` / `.manage` |
| Satuan | `/api/v1/master/uoms` | `master.uom.view` / `.manage` |
| Supplier | `/api/v1/master/suppliers` | `master.supplier.view` / `.manage` |
| Gudang | `/api/v1/master/warehouses` | `master.warehouse.view` / `.manage` |
| Lokasi gudang | `POST /api/v1/master/warehouses/{id}/locations`, `PATCH /api/v1/master/locations/{id}` | `master.warehouse.manage` |
| Produk | `/api/v1/master/products` | `master.product.view` / `.manage` |
| Varian produk | `POST /api/v1/master/products/{id}/variants`, `PATCH /api/v1/master/variants/{id}` | `master.product.manage` |
| BOM | `/api/v1/master/boms` | `master.bom.view` / `.manage` |
| Item BOM | `POST /api/v1/master/boms/{id}/items`, `DELETE /api/v1/master/bom-items/{id}` | `master.bom.manage` |
| Versi BOM | `POST /api/v1/master/boms/{id}/version` | `master.bom.manage` |
| Aktivasi BOM | `POST /api/v1/master/boms/{id}/activate` / `deactivate` | `master.bom.manage` |

### 3.11 Pengguna (khusus Administrator)

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/users?query=` | `user.view` |
| POST | `/api/v1/users` | `user.create` |
| PATCH | `/api/v1/users/{id}` | `user.update` |
| PUT | `/api/v1/users/{id}/roles` | `user.assign_roles` |
| POST | `/api/v1/users/{id}/password` | `user.set_password` |
| POST | `/api/v1/users/{id}/ban` | `user.ban` |

```json
// POST /api/v1/users
{ "name": "Sales Baru", "email": "sales.baru@garment.local", "password": "password123", "roleCodes": ["SALES"] }

// PUT /api/v1/users/{id}/roles
{ "roleCodes": ["SALES", "WAREHOUSE"] }

// POST /api/v1/users/{id}/password
{ "newPassword": "password-baru-123" }

// POST /api/v1/users/{id}/ban
{ "banned": true, "reason": "Mutasi keluar" }
```

Role valid: `ADMIN`, `MANAGER`, `SALES`, `PURCHASING`, `WAREHOUSE`,
`PRODUCTION_SUPERVISOR`, `QC_STAFF`, `SHIPPING_STAFF`.

### 3.12 Audit log (khusus Administrator)

| Method | Path | Izin |
|---|---|---|
| GET | `/api/v1/audit-logs?query=&action=&page=&pageSize=` | `audit.view` |

Respons read-only berisi `action`, `entityType`, `entityId`, `details`, `createdAt`,
dan aktor. Halaman UI: `/settings/audit` (tabel + pencarian + filter aksi). Audit log
tidak menyediakan operasi ubah/hapus.

## 4. Catatan implementasi

- Route handler tipis: `auth → Zod → service → respons`; logika bisnis di `src/modules/*`.
- Mutasi multi-tabel selalu dalam satu transaksi database + audit log.
- Halaman membaca data langsung lewat service layer dari Server Component (tidak
  fetch ke API sendiri); API terutama dipakai form/dialog klien dan integrasi eksternal.
- Uji kontrak API: `tests/e2e/security.spec.ts` (401/403/404/409/422 + idempotency).

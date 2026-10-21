import { isRoleCode, roleLabel } from "@/lib/permissions";

const ACTION_LABELS: Record<string, string> = {
  "bom.activate": "Aktifkan BOM",
  "bom.create": "Buat BOM",
  "bom.deactivate": "Nonaktifkan BOM",
  "bom-item.create": "Tambah item BOM",
  "bom-item.delete": "Hapus item BOM",
  "bom.revise": "Revisi BOM",
  "buyer.create": "Buat buyer",
  "department.create": "Buat departemen",
  "employee.create": "Buat karyawan",
  "finished-goods.receive": "Terima barang jadi",
  "inventory.adjust": "Penyesuaian stok",
  "inventory.transfer": "Transfer stok",
  "material.create": "Buat material",
  "material-receipt.cancel": "Batalkan penerimaan",
  "material-receipt.create": "Buat penerimaan",
  "material-receipt.post": "Posting penerimaan",
  "material-receipt.update": "Ubah penerimaan",
  "product.create": "Buat produk",
  "production.cancel": "Batalkan SPK",
  "production.create": "Buat SPK",
  "production.issue-material": "Catat pemakaian material",
  "production-line.create": "Buat lini produksi",
  "production.record-output": "Catat output produksi",
  "product-variant.create": "Buat varian produk",
  "purchase-order.cancel": "Batalkan PO",
  "purchase-order.create": "Buat PO",
  "purchase-order.order": "Pesan ke supplier",
  "purchase-order.update": "Ubah PO",
  "qc.inspect": "Inspeksi QC",
  "sales-order.allocate": "Alokasi barang jadi",
  "sales-order.cancel": "Batalkan sales order",
  "sales-order.confirm": "Konfirmasi sales order",
  "sales-order.create": "Buat sales order",
  "sales-order.release-allocation": "Lepas alokasi",
  "sales-order.update": "Ubah sales order",
  "shipment.cancel": "Batalkan pengiriman",
  "shipment.create": "Buat pengiriman",
  "shipment.post": "Posting pengiriman",
  "supplier.create": "Buat supplier",
  "uom.create": "Buat satuan",
  "user.create": "Buat pengguna",
  "user.password.reset": "Reset kata sandi",
  "user.roles.assign": "Tetapkan role",
  "user.update": "Ubah pengguna",
  "warehouse.create": "Buat gudang",
  "warehouse-location.create": "Buat lokasi gudang",
};

const ENTITY_LABELS: Record<string, string> = {
  bom: "BOM",
  "bom-item": "Item BOM",
  buyer: "Buyer",
  department: "Departemen",
  employee: "Karyawan",
  "finished-goods-lot": "Lot barang jadi",
  "inventory-transaction": "Mutasi stok",
  material: "Material",
  "material-issue": "Pemakaian material",
  "material-receipt": "Penerimaan material",
  product: "Produk",
  "production-line": "Lini produksi",
  "production-order": "SPK",
  "production-record": "Catatan produksi",
  "product-variant": "Varian produk",
  "purchase-order": "Purchase order",
  "qc-inspection": "Inspeksi QC",
  "sales-order": "Sales order",
  shipment: "Pengiriman",
  supplier: "Supplier",
  uom: "Satuan",
  user: "Pengguna",
  warehouse: "Gudang",
  "warehouse-location": "Lokasi gudang",
};

const VALUE_LABELS: Record<string, string> = {
  ACCEPT: "Terima",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
  CONFIRMED: "Dikonfirmasi",
  CUTTING: "Cutting",
  DRAFT: "Draf",
  FAIL: "Gagal",
  FINISHED_GOOD: "Barang jadi",
  FINISHING: "Finishing",
  IN: "Masuk",
  IN_PRODUCTION: "Dalam Produksi",
  IN_PROGRESS: "Berjalan",
  ISSUE: "Pengeluaran",
  MATERIAL: "Material",
  OPEN: "Terbuka",
  ORDERED: "Dipesan",
  OUT: "Keluar",
  PACKING: "Packing",
  PARTIALLY_RECEIVED: "Diterima Sebagian",
  PARTIALLY_SHIPPED: "Terkirim Sebagian",
  PASS: "Lolos",
  PENDING: "Menunggu",
  POSTED: "Diposting",
  READY_TO_SHIP: "Siap Kirim",
  RECEIVED: "Diterima Lengkap",
  RECEIPT: "Penerimaan",
  REJECT: "Tolak",
  RESERVE: "Reservasi",
  RETURN: "Kembalikan",
  REWORK: "Rework",
  SCRAP: "Afkir",
  SEWING: "Sewing",
  SHIPPED: "Terkirim",
  TRANSFER: "Transfer",
  UNRESERVE: "Batal Reservasi",
};

const DETAIL_LABELS: Record<string, string> = {
  acceptedQuantity: "Jumlah diterima baik",
  address: "Alamat",
  bomVersion: "Versi BOM",
  changes: "Perubahan",
  code: "Kode",
  color: "Warna",
  contactName: "Nama kontak",
  contactPhone: "Telepon kontak",
  date: "Tanggal",
  defectCount: "Jumlah cacat",
  deliveryNote: "Catatan pengiriman",
  description: "Deskripsi",
  dueDate: "Tenggat",
  effectiveFrom: "Berlaku dari",
  effectiveUntil: "Berlaku sampai",
  email: "Email",
  expectedDate: "Estimasi datang",
  fromStatus: "Status awal",
  fromVersion: "Versi awal",
  inspectedQuantity: "Jumlah diperiksa",
  isActive: "Status aktif",
  isRework: "Rework",
  item: "Item",
  itemCount: "Jumlah item",
  issuedAt: "Tanggal pemakaian",
  location: "Lokasi",
  materialCode: "Kode material",
  materialId: "ID material",
  materialName: "Nama material",
  name: "Nama",
  notes: "Catatan",
  number: "Nomor",
  orderDate: "Tanggal pesanan",
  orderStatus: "Status pesanan",
  orderedQuantity: "Jumlah dipesan",
  parentInspectionId: "ID inspeksi induk",
  passedQuantity: "Jumlah lolos",
  phone: "Telepon",
  processedQuantity: "Jumlah diproses",
  productCode: "Kode produk",
  productName: "Nama produk",
  productSku: "SKU produk",
  purchaseOrderId: "ID purchase order",
  quantity: "Kuantitas",
  quantityPerUnit: "Qty per unit",
  reason: "Alasan",
  receivedAt: "Tanggal terima",
  receivedQuantity: "Jumlah diterima",
  rejectedQuantity: "Jumlah cacat",
  result: "Hasil",
  roleCodes: "Role",
  salesOrderId: "ID sales order",
  shipmentId: "ID pengiriman",
  shippedAt: "Tanggal kirim",
  shortageCount: "Jumlah kekurangan",
  shortageReason: "Alasan kekurangan",
  size: "Ukuran",
  sku: "SKU",
  stageCode: "Tahap",
  toStatus: "Status akhir",
  toVersion: "Versi baru",
  totalQuantity: "Total kuantitas",
  unitCode: "Satuan",
  unitPrice: "Harga satuan",
  variantId: "ID varian",
  variantSku: "SKU varian",
  version: "Versi",
  warehouseName: "Gudang",
};

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeEnum(value: string): string {
  const words = value.toLowerCase().split("_");
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") return value ? "Ya" : "Tidak";

  if (key === "roleCodes" && Array.isArray(value)) {
    return value
      .map((code) => (typeof code === "string" && isRoleCode(code) ? roleLabel(code) : String(code)))
      .join(", ");
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue("", item)).join(", ");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "—";
    return entries
      .map(([childKey, childValue]) => {
        const label = DETAIL_LABELS[childKey] ?? humanizeKey(childKey);
        return `${label}: ${formatValue(childKey, childValue)}`;
      })
      .join("; ");
  }

  if (typeof value === "string") {
    if (VALUE_LABELS[value]) return VALUE_LABELS[value];
    if (/^[A-Z][A-Z0-9_]*$/.test(value)) return humanizeEnum(value);
  }

  return String(value);
}

/** Label aksi audit yang ramah dibaca; kode mentah tetap disimpan di atribut title. */
export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? humanizeKey(action.replace(/\./g, " "));
}

/** Label entitas audit yang ramah dibaca. */
export function formatAuditEntity(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? humanizeKey(entityType);
}

/** Ubah detail audit mentah menjadi teks ringkas yang mudah dibaca. */
export function formatAuditDetails(details: Record<string, unknown> | null): string {
  if (!details || Object.keys(details).length === 0) return "—";

  return Object.entries(details)
    .map(([key, value]) => {
      const label = DETAIL_LABELS[key] ?? humanizeKey(key);
      return `${label}: ${formatValue(key, value)}`;
    })
    .join(" · ");
}

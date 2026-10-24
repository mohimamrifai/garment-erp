# Audit Otorisasi & Review Keamanan (F6.3–F6.4)

Tanggal: 24 Oktober 2026 · Lingkup: aplikasi Garment ERP v1.1 (build produksi `next start`, database seed).
Dokumen ini merangkum hasil audit otorisasi menyeluruh (F6.3) dan review keamanan ringkas (F6.4).

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| Guard API (semua endpoint `/api/v1`) | ✅ | 86 route handler, semuanya lewat `requireApiPermission()` sebelum membaca body/query. |
| Guard halaman dashboard | ✅ | 55 halaman; hanya `/dashboard` dan `/akses-ditolak` tanpa guard izin (keduanya boleh untuk semua role login). |
| Menu sidebar vs izin | ✅ | Visibilitas menu mengikuti `nav-config.ts`; penegakan sebenarnya tetap di halaman & route. |
| Uji negatif keamanan | ✅ | `tests/e2e/security.spec.ts` (10 skenario) lulus terhadap build produksi. |
| Secrets | ✅ | Hanya lewat environment variable; `.env*` di-`.gitignore`, contoh aman di `.env.example`. |
| Pesan error | ✅ | Tidak membocorkan query/schema/stack trace; kode mesin stabil. |
| Cookie & sesi | ✅ | `HttpOnly`, `SameSite=Lax`, `Secure` di HTTPS, umur 7 hari, `updateAge` 1 hari. |
| Security header | ✅ | `nosniff`, `DENY` frame, referrer/policy, HSTS (ditambahkan di F6). |
| Rate limit | ✅ | Aktif pada produksi (Better Auth), dimatikan hanya untuk E2E via env khusus. |

## 2. Audit otorisasi (F6.3)

Sumber kebenaran: `src/lib/permissions.ts` (matriks `PERMISSION_MATRIX`), diterapkan oleh:

- API: `requireApiPermission(request, permission)` di setiap route handler (`src/app/api/v1/**/route.ts`).
- Halaman: `requirePagePermission(permission)` di setiap Server Component halaman (`src/app/(dashboard)/**/page.tsx`).
- Proxy (`src/proxy.ts`) hanya cek optimistis keberadaan cookie; pemeriksaan sesi nyata di Data Access Layer (`src/lib/auth/session.ts`).

Hasil inventaris:

| Modul | Endpoint | Izin |
|---|---|---|
| Auth (Better Auth) | `/api/auth/*` | Publik sesuai konfigurasi (login/logout/sesi), pendaftaran publik dimatikan. |
| Buyer | `GET/POST /api/v1/buyers`, `PATCH /api/v1/buyers/:id` | `buyer.view` / `buyer.create` / `buyer.update` |
| Sales order | `GET/POST /api/v1/sales-orders`, `GET/PATCH /:id` | `so.view` / `so.create` / `so.update` |
| Sales order aksi | `POST /:id/confirm`, `POST /:id/cancel` | `so.confirm` / `so.cancel` |
| Pemenuhan & alokasi | `GET /:id/fulfillment`, `POST /:id/allocations`, `POST /:id/allocations/release` | `so.view` / `fg.allocate` |
| Purchase order | `GET/POST /api/v1/purchase-orders`, `GET/PATCH /:id`, `POST /:id/order`, `POST /:id/cancel` | `po.view` / `po.create` / `po.update` / `po.order` / `po.cancel` |
| Penerimaan material | `GET/POST /api/v1/material-receipts`, `GET/PATCH /:id`, `POST /:id/post`, `POST /:id/cancel` | `receipt.*` |
| Inventori | `GET /api/v1/inventory/balances`, `GET /api/v1/inventory/transactions` | `inventory.view` |
| Inventori aksi | `POST /api/v1/inventory/transfers`, `POST /api/v1/inventory/adjustments` | `inventory.move` / `inventory.adjust` |
| Produksi | `GET/POST /api/v1/production-orders`, `GET /:id`, `GET /api/v1/production/planning` | `production.view` / `production.create` |
| Produksi aksi | `POST /:id/records`, `POST /:id/issues`, `POST /:id/cancel` | `production.record` / `production.issue` / `production.cancel` |
| QC | `GET/POST /api/v1/qc-inspections`, `GET /:id` | `qc.view` / `qc.inspect` |
| Barang jadi | `GET /api/v1/finished-goods` | `fg.view` |
| Pengiriman | `GET/POST /api/v1/shipments`, `GET /:id`, `POST /:id/post`, `POST /:id/cancel` | `shipment.*` |
| Laporan | `GET /api/v1/reports/export` | `report.view` + `canAccessReport(role)` per laporan |
| Master data | `/api/v1/master/**` (12 submodul) | `master.*.view` (GET) / `master.*.manage` (mutasi) |
| Pengguna | `GET/POST /api/v1/users`, `PATCH /:id`, `PUT /:id/roles`, `POST /:id/password`, `POST /:id/ban` | `user.*` (khusus ADMIN) |
| HRIS | `/api/v1/hr/attendance`, `/api/v1/hr/leave-requests` | `hr.attendance.*`, `hr.leave.*` |
| Payroll | `/api/v1/payroll/runs`, `/:id/approve`, `/:id/pay`, `/:id/cancel` | `payroll.view` / `.run` / `.approve` / `.pay` |
| Akuntansi | `/api/v1/accounting/accounts`, `journals`, `payments`, `periods` | `accounting.view` / `.manage` / `.post` / `.pay` / `.close` |
| Audit log | `GET /api/v1/audit-logs` + halaman `/settings/audit` | `audit.view` (khusus ADMIN) |

Temuan & perbaikan:

1. **ID non-UUID menghasilkan 500** — `GET /api/v1/shipments/id-ngawur` gagal di Postgres
   (`22P02`) dan mengembalikan 500 generik. Meski pesan ke klien tidak membocorkan query,
   status 500 untuk input tak valid adalah bug. Drizzle membungkus error driver sehingga
   kode Postgres dicek hingga `error.cause`; sekarang dipetakan ke
   `404 { error: { code: "NOT_FOUND" } }` (`src/lib/api/response.ts`), berlaku untuk semua
   endpoint `/:id`. Uji regresi: `security.spec.ts` › "manipulasi ID dan item milik dokumen lain ditolak".
2. **Item dokumen lain tidak dapat dicampur** — item pengiriman yang bukan milik sales order
   diuji dan ditolak `400 BAD_REQUEST` ("Ada item pengiriman yang bukan milik sales order ini.").
3. **Guard dievaluasi sebelum validasi body** — permintaan lintas role dengan body kosong
   tetap `403`, bukan `422`, sehingga tidak membocorkan bentuk skema ke role tak berwenang.
4. **Permission `audit.view` sebelumnya tanpa pemakai** — M11 (Audit Log) hanya menulis
   catatan tanpa penampil. Ditambahkan halaman read-only `/settings/audit` + endpoint
   `GET /api/v1/audit-logs` (khusus ADMIN, tanpa operasi ubah/hapus, sesuai PRD §6.10).

## 3. Review keamanan (F6.4)

### Secrets & konfigurasi

- Kredensial hanya dari environment variable (`DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`); tidak ada nilai rahasia di kode maupun repo.
- `.gitignore` mengecualikan `.env*` kecuali `.env.example`; tidak ada file `.env` yang terlacak git.
- `.env.example` hanya berisi placeholder lokal dan komentar cara membuat secret
  (`openssl rand -base64 32`).
- Workflow CI memakai kredensial database lokal sementara di service container (bukan rahasia produksi).
- `NEXT_PUBLIC_DEMO_MODE` dan akun demo bersifat **publik pada deployment demo** (keputusan
  produk); untuk deployment non-demo, jangan aktifkan `NEXT_PUBLIC_DEMO_MODE` dan ganti
  password seed (`SEED_DEFAULT_PASSWORD`).

### Autentikasi & sesi (Better Auth)

- Registrasi publik dimatikan (`disableSignUp: true`); akun dibuat Administrator lewat API/UI pengguna.
- Password minimal 8 karakter, hashing default Better Auth (scrypt).
- Sesi 7 hari dengan perpanjangan otomatis harian; cookie `HttpOnly`, `SameSite=Lax`,
  `Secure` otomatis saat base URL HTTPS (produksi), `Path=/`.
- Rate limit default aktif di produksi (`/sign-in`: 3 percobaan / 10 detik per IP);
  khusus E2E dimatikan via `E2E_DISABLE_RATE_LIMIT=1` yang hanya di-set `playwright.config.ts`.
- Login gagal selalu menampilkan pesan generik ("Email atau password salah.") — tidak
  membedakan email tidak ada vs password salah; akun nonaktif diberi pesan jelas sesuai kebutuhan UX.

### RBAC & audit

- Matriks izin terketik (`Permission`) mencegah permission string liar; role disimpan di
  `roles`/`user_roles` (satu user bisa multi-role).
- Administrator tidak dapat mencabut role Administrator dari akun sendiri dan tidak dapat
  menonaktifkan akun sendiri (guard service + uji E2E).
- Mutasi penting mencatat audit log (`recordAudit`) dalam transaksi yang sama, termasuk
  transfer/penyesuaian stok, posting dokumen, alokasi, aksi pengguna, absensi/cuti,
  payroll, jurnal, pembayaran, dan tutup buku.
- Role back-office (`HR_STAFF`, `PAYROLL_ADMIN`, `FINANCE_STAFF`) tidak ditampilkan di
  tombol masuk cepat; aksesnya tetap diperiksa di server dan diuji E2E (`finance.spec.ts`).

### Pesan error & data bocor

- Format error seragam `{ error: { code, message, details? } }`; error tak tertangani menjadi
  `500 INTERNAL_ERROR` dengan pesan generik dan detail hanya di log server.
- Validasi input memakai Zod dengan pesan Bahasa Indonesia; detail field ramah form.
- Tidak ada `dangerouslySetInnerHTML` di kode aplikasi.
- Semua query data memakai Drizzle (parameterized), tanpa string SQL dari input pengguna.

### Header HTTP (baru di F6)

`next.config.ts` mengirim untuk semua respons: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains`, serta
`poweredByHeader: false` (tidak ada `X-Powered-By`).

Verifikasi: `curl -D - http://localhost:3000/login` (bukti header di atas) dan
`curl -D - -X POST /api/auth/sign-in/email` (cookie `HttpOnly; SameSite=Lax; Max-Age=604800`).

## 4. Uji negatif otomatis (F6.2)

`tests/e2e/security.spec.ts` dijalankan terhadap build produksi (`pnpm build && pnpm test:e2e`):

1. Tanpa sesi: 10 endpoint data mengembalikan `401 UNAUTHENTICATED` tanpa field `data`.
2. Purchasing: `403 FORBIDDEN` pada pengiriman, barang jadi, tulis pengiriman, dan laporan role lain.
3. QC tidak dapat membuat SPK; shipping tidak dapat membaca/membuat pengguna.
4. Kuantitas negatif/nol/pecahan dan daftar item kosong ditolak `422 VALIDATION_ERROR`
   dengan detail field Bahasa Indonesia.
5. Kuantitas melebihi sisa pesanan ditolak `409 CONFLICT`.
6. ID non-UUID → `404 NOT_FOUND`; UUID tidak ada → `404`; item milik sales order lain → `400`.
7. Surat jalan terposting tidak dapat diposting/dibatalkan dua kali (`409`).
8. Transfer stok dengan `idempotencyKey` sama tidak menggandakan mutasi (id transaksi sama,
   saldo tujuan hanya bertambah sekali).

## 5. Keterbatasan & rekomendasi (masuk backlog)

- CSP (Content-Security-Policy) ketat belum dipasang karena Next.js memakai inline script;
  rencanakan nonce-based CSP pasca-MVP.
- Belum ada 2FA/MFA dan audit login (hanya audit aksi bisnis).
- Belum ada pengujian penetrasi pihak ketiga; uji negatif di atas bersifat otomatis.
- Neon/Vercel free tier: jangan aktifkan kredensial demo di deployment yang memuat data nyata.

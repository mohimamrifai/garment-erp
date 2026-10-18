# Design System — "Pabrik"

> Bahasa visual Garment ERP: presisi teknis-industrial. Dokumen ini adalah acuan tunggal
> token, komponen, dan aturan; keputusan visual di luar dokumen ini dianggap penyimpangan.

## 1. Posisi & Kepribadian

ERP ini dipakai operator, admin, dan supervisor pabrik selama berjam-jam. Karena itu
arahnya **alat kerja**, bukan halaman pemasaran:

- **Padat** (density tinggi): garis rambut 1px, tinggi baris rapat, informasi prioritas
  di atas lipatan.
- **Jujur** ke domain: kode dokumen pabrik (`SO-`, `PO-`, `RCV-`, `SPK-`, `SJ-`),
  angka selalu rata kolom (tabular), istilah operasional.
- **Satu aksen**: oranye industri (hue ~46) hanya untuk fokus, nav aktif, dan penanda;
  tombol utama tetap tinta graphite.
- **Tanpa dekorasi palsu**: tidak ada gradien, glassmorphism, drop shadow berlapis,
  atau bentuk pill yang tidak bermakna.

Dials (mengikuti metode taste-skill): `DESIGN_VARIANCE 3 · MOTION 3 · VISUAL_DENSITY 8`.

## 2. Warna

Semua token didefinisikan di `src/app/globals.css` (`:root` = terang, `.dark` = gelap)
dan diregistrasi ke Tailwind via `@theme inline`, sehingga utility seperti `bg-brand`,
`text-success`, `border-border` otomatis tersedia.

| Peran | Token | Terang | Gelap | Catatan |
| --- | --- | --- | --- | --- |
| Latar halaman | `--background` | `oklch(0.98 0.003 75)` | `oklch(0.168 0.005 75)` | netral hangat (hue 75), bukan abu biru |
| Permukaan | `--card` / `--popover` | `oklch(0.995 0.0015 75)` | `oklch(0.205 0.006 75)` | kartu hanya untuk panel/elevasi |
| Tinta | `--foreground` | `oklch(0.205 0.006 75)` | `oklch(0.945 0.003 75)` | teks utama |
| Tinta sekunder | `--muted-foreground` | `oklch(0.505 0.01 75)` | `oklch(0.7 0.008 75)` | ≥ 4.5:1 terhadap latar |
| Garis | `--border` / `--input` | `oklch(0.892)` / `0.868` | `putih 9%` / `14%` | garis rambut & tepi field |
| Aksen | `--brand` | `oklch(0.62 0.155 45)` | `oklch(0.7 0.155 48)` | fokus, nav aktif, penanda |
| Aksen teks | `--brand-strong` | `oklch(0.5 0.135 45)` | `oklch(0.78 0.14 50)` | untuk teks di atas latar terang |
| Aksen di atas aksen | `--brand-foreground` | `oklch(0.205 0.006 75)` | `oklch(0.168 0.005 75)` | ikon/dark di dalam kotak oranye |
| Sukses / Peringatan / Info | `--success` / `--warning` / `--info` | — | — | status aktif, peringatan, informasi |
| Bahaya | `--destructive` | `oklch(0.553 0.196 27)` | `oklch(0.66 0.18 25)` | aksi destruktif & status nonaktif |

**Sidebar selalu graphite gelap di kedua mode** (`--sidebar*`): panel mesin di sisi kiri,
konten terang di kanan. Ini keputusan identitas, bukan tema.

Aturan pemakaian aksen:
- `--ring` = oranye → semua `focus-visible` sudah oranye otomatis.
- Nav aktif: garis oranye 3px + ikon oranye (`data-active` di `SidebarMenuButton`).
- Logo/favicon: kotak oranye + glyph graphite (`src/app/icon.svg`).
- Tombol primer tetap `--primary` (tinta). Jangan membuat tombol oranye besar.

## 3. Tipografi

- **UI/teks**: IBM Plex Sans (`--font-sans`, weight 400/500/600/700).
- **Angka, kode, metadata teknis**: IBM Plex Mono (`--font-mono`, 400/500/600).
  Semua nilai numerik di tabel, kode dokumen (`BUY-0001`, `SO-202610-0001`), tanggal,
  ID, dan counter memakai mono + `tabular-nums` (utility `.nums` / `tabular-nums`).

Skala yang dipakai (tanpa heading raksasa — ini aplikasi, bukan landing):

| Peran | Kelas | Contoh |
| --- | --- | --- |
| Judul halaman | `text-xl font-semibold tracking-tight` | "Buyer" |
| Judul kartu/dialog | `text-[15px] font-semibold tracking-tight` | "Tambah Buyer" |
| Teks UI standar | `text-sm` | isi tabel & form |
| Teks padat | `text-[13px]` / `text-xs` | deskripsi, sel tabel |
| Label mikro | `text-[11px] font-mono uppercase tracking-widest` | header tabel, label section sidebar |

Aturan: **huruf kapital mono** hanya untuk label struktural (header tabel, section
sidebar, counter halaman). Jangan pakai untuk kalimat.

## 4. Bentuk, Kepadatan, Ruang

- **Radius**: dua langkah saja — tag/badge `rounded-sm` (≈5px), kontrol & permukaan
  `rounded-lg` (8px). Tidak ada pill (kecuali dot status) dan tidak ada kartu 16px+.
- **Elevasi**: kartu = `ring-1 ring-border` tanpa shadow; dialog & menu =
  `shadow-md shadow-foreground/5` + `ring-border`. Backdrop dialog: `bg-black/25`
  (gelap: `bg-black/55`), tanpa blur.
- **Tabel**: header 11px uppercase muted di atas `bg-muted/40`, baris `px-3 py-2.5`,
  hover `bg-muted/40`, garis rambut `--border`. Angka selalu tabular.
- **Toolbar halaman**: search (±288px) + filter di kiri, aksi primer di kanan;
  tinggi kontrol default 32px (`h-8`), form besar 36px (`h-9`).
- **Ikon**: Lucide, ukuran 16px (`size-4`) pada kontrol, 12–14px pada metadata.
  Ikon harus bermakna (aksi/status), bukan hiasan.

## 5. Konvensi Komponen

| Komponen | Aturan |
| --- | --- |
| `Button` | primer = tinta (`default`), sekunder = `outline`, tersier = `ghost`; teks aksi imperatif Bahasa Indonesia ("Simpan", "Tambah Buyer") |
| `Badge` | status = `outline` + tint (`border-success/30 bg-success/10 text-success`) + dot 6px; metadata/role = `secondary`; mono untuk kode/fase |
| `Table` | selalu dibungkus `rounded-lg border overflow-hidden`; kolom aksi `text-right` |
| `Dialog` | header judul 15px + deskripsi muted, footer `bg-muted/50` dengan tombol kanan (`Batal` lalu aksi) |
| `Field`/`Input` | label 13px `text-foreground/90`, input `h-8 rounded-lg border-input`, error di bawah field (`FieldError`), fokus = ring oranye |
| Sidebar | grup label mono uppercase `text-sidebar-foreground/60`, item aktif = garis oranye + ikon oranye |
| Empty state | ikon + judul + deskripsi + jalan keluar (aksi/filter), dibungkus kartu berborder |

## 6. Yang Dilarang (anti AI-slop)

1. Gradien dekoratif, teks gradien, glassmorphism, border tebal warna-warni.
2. Warna ungu/indigo "template SaaS", aksen kedua, atau lebih dari satu warna merek.
3. Bentuk pill untuk tombol/badge struktural; radius berbeda-beda tanpa alasan.
4. Angka/kode dalam font proporsional; angka tidak rata kolom.
5. Kartu di dalam kartu; shadow berlapis; emoji menggantikan ikon.
6. Huruf kapital untuk kalimat; label mikro berlebihan di teks panjang.
7. Animasi berlebihan pada alat kerja (motion hanya untuk umpan balik, 100–200ms).

## 7. Implementasi

- Token & base styles: `src/app/globals.css`.
- Font & theme provider: `src/app/layout.tsx` (+ `src/components/theme-provider.tsx`).
- Toggle tema: menu di `src/components/layout/app-header.tsx` (Terang / Gelap / Sistem).
- Primitif UI: `src/components/ui/*` (preset shadcn/Base UI, di-retokn di sini — jangan
  fork komponen tanpa alasan; ubah token/variant lebih dulu).
- Favicon/brand mark: `src/app/icon.svg`.

Kontribusi baru harus: memakai token (bukan warna literal), angka lewat mono/tabular,
dan mematuhi aturan radius di atas. Perubahan visual besar dicatat di dokumen ini.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Konfigurasi Better Auth.
 *
 * - Identitas: email + password. Pendaftaran publik DIMATIKAN — akun dibuat
 *   oleh Admin melalui plugin admin (lihat `src/modules/user`).
 * - Otorisasi aplikasi: tabel `roles`/`user_roles` (lihat `src/lib/permissions`).
 *   Kolom `user.role` milik plugin admin hanya menyimpan penanda "admin"/"user"
 *   yang disinkronkan dari role ADMIN dan TIDAK dipakai untuk RBAC aplikasi.
 */
export const auth = betterAuth({
  appName: "Garment ERP",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Tidak ada registrasi publik; akun dibuat admin.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    // Umur sesi 7 hari, diperpanjang otomatis sekali sehari.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // nextCookies() harus berada di posisi terakhir.
    nextCookies(),
  ],
});

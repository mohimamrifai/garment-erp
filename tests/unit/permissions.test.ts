import { describe, expect, it } from "vitest";
import {
  can,
  isRoleCode,
  PERMISSION_MATRIX,
  ROLE_CODES,
  ROLE_SEED,
  roleLabel,
} from "@/lib/permissions";

describe("RBAC: definisi role", () => {
  it("memiliki 8 role unik sesuai PRD", () => {
    expect(ROLE_CODES).toHaveLength(8);
    expect(new Set(ROLE_CODES).size).toBe(8);
    expect([...ROLE_SEED.map((role) => role.code)].sort()).toEqual([...ROLE_CODES].sort());
  });

  it("isRoleCode hanya menerima kode persis", () => {
    expect(isRoleCode("ADMIN")).toBe(true);
    expect(isRoleCode("admin")).toBe(false);
    expect(isRoleCode("SUPERUSER")).toBe(false);
  });

  it("setiap role seed punya nama dan deskripsi", () => {
    for (const role of ROLE_SEED) {
      expect(role.name.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });
});

describe("RBAC: matriks izin", () => {
  it("setiap permission punya minimal satu role", () => {
    for (const [permission, roles] of Object.entries(PERMISSION_MATRIX)) {
      expect(roles.length, permission).toBeGreaterThan(0);
    }
  });

  it("can() mengizinkan role yang terdaftar", () => {
    expect(can(["ADMIN"], "user.view")).toBe(true);
    expect(can(["SALES", "ADMIN"], "buyer.create")).toBe(true);
    expect(can(["SALES"], "buyer.view")).toBe(true);
  });

  it("can() menolak role lain dan daftar kosong", () => {
    expect(can(["SALES"], "user.view")).toBe(false);
    expect(can(["QC_STAFF"], "buyer.view")).toBe(false);
    expect(can(["WAREHOUSE"], "user.ban")).toBe(false);
    expect(can([], "buyer.view")).toBe(false);
  });

  it("roleLabel memakai nama Indonesia", () => {
    expect(roleLabel("WAREHOUSE")).toBe("Gudang");
    expect(roleLabel("QC_STAFF")).toBe("Staff QC");
    expect(roleLabel("PRODUCTION_SUPERVISOR")).toBe("Supervisor Produksi");
  });
});

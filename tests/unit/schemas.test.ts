import { describe, expect, it } from "vitest";
import { buyerFormSchema, listBuyersQuerySchema, updateBuyerSchema } from "@/modules/buyer/schemas";
import { createUserSchema, listUsersQuerySchema } from "@/modules/user/schemas";

describe("skema buyer", () => {
  it("menolak nama terlalu pendek", () => {
    expect(buyerFormSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("menerima bidang opsional kosong (form web)", () => {
    const parsed = buyerFormSchema.safeParse({
      name: "PT Contoh",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("menolak email tidak valid", () => {
    expect(buyerFormSchema.safeParse({ name: "PT Contoh", email: "bukan-email" }).success).toBe(
      false,
    );
  });

  it("query list memakai default page/pageSize/status", () => {
    expect(listBuyersQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 10,
      status: "all",
    });
  });

  it("update parsial menerima perubahan status saja", () => {
    expect(updateBuyerSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe("skema pengguna", () => {
  const base = {
    name: "Budi Santoso",
    email: "budi@garment.local",
    password: "password123",
  };

  it("menerima input valid", () => {
    expect(createUserSchema.safeParse({ ...base, roleCodes: ["SALES", "WAREHOUSE"] }).success).toBe(
      true,
    );
  });

  it("menolak role tak dikenal", () => {
    expect(createUserSchema.safeParse({ ...base, roleCodes: ["SUPERMAN"] }).success).toBe(false);
  });

  it("menolak daftar role kosong", () => {
    expect(createUserSchema.safeParse({ ...base, roleCodes: [] }).success).toBe(false);
  });

  it("menolak password kurang dari 8 karakter", () => {
    expect(
      createUserSchema.safeParse({ ...base, password: "pendek", roleCodes: ["SALES"] }).success,
    ).toBe(false);
  });

  it("query list default pageSize 50", () => {
    expect(listUsersQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 50 });
  });
});

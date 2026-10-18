import { describe, expect, it } from "vitest";
import {
  checkEffectAgainstBalance,
  movementEffects,
  roundQuantity,
  toQuantityString,
  validateMovementShape,
} from "@/modules/inventory/engine";

const LOCATION_A = "11111111-1111-1111-1111-111111111111";
const LOCATION_B = "22222222-2222-2222-2222-222222222222";

describe("validateMovementShape", () => {
  it("menerima bentuk mutasi yang sah", () => {
    expect(
      validateMovementShape({ transactionType: "RECEIPT", quantity: 5, toLocationId: LOCATION_A }),
    ).toBeNull();
    expect(
      validateMovementShape({ transactionType: "ISSUE", quantity: 5, fromLocationId: LOCATION_A }),
    ).toBeNull();
    expect(
      validateMovementShape({
        transactionType: "TRANSFER",
        quantity: 5,
        fromLocationId: LOCATION_A,
        toLocationId: LOCATION_B,
      }),
    ).toBeNull();
    expect(
      validateMovementShape({ transactionType: "ADJUSTMENT_IN", quantity: 1, toLocationId: LOCATION_A }),
    ).toBeNull();
    expect(
      validateMovementShape({
        transactionType: "ADJUSTMENT_OUT",
        quantity: 1,
        fromLocationId: LOCATION_A,
      }),
    ).toBeNull();
    expect(
      validateMovementShape({ transactionType: "RESERVE", quantity: 1, fromLocationId: LOCATION_A }),
    ).toBeNull();
    expect(
      validateMovementShape({ transactionType: "UNRESERVE", quantity: 1, fromLocationId: LOCATION_A }),
    ).toBeNull();
  });

  it("menolak kuantitas nol, negatif, atau bukan angka", () => {
    expect(
      validateMovementShape({ transactionType: "RECEIPT", quantity: 0, toLocationId: LOCATION_A }),
    ).toMatch(/lebih dari 0/);
    expect(
      validateMovementShape({ transactionType: "RECEIPT", quantity: -3, toLocationId: LOCATION_A }),
    ).toMatch(/lebih dari 0/);
    expect(
      validateMovementShape({
        transactionType: "RECEIPT",
        quantity: "abc",
        toLocationId: LOCATION_A,
      }),
    ).toMatch(/lebih dari 0/);
  });

  it("menolak lokasi yang tidak sesuai arah mutasi", () => {
    expect(validateMovementShape({ transactionType: "RECEIPT", quantity: 1 })).toMatch(
      /Lokasi tujuan wajib/,
    );
    expect(
      validateMovementShape({
        transactionType: "RECEIPT",
        quantity: 1,
        toLocationId: LOCATION_A,
        fromLocationId: LOCATION_B,
      }),
    ).toMatch(/Lokasi asal tidak boleh/);
    expect(validateMovementShape({ transactionType: "ISSUE", quantity: 1 })).toMatch(
      /Lokasi asal wajib/,
    );
    expect(
      validateMovementShape({
        transactionType: "TRANSFER",
        quantity: 1,
        fromLocationId: LOCATION_A,
      }),
    ).toMatch(/Lokasi tujuan wajib/);
    expect(
      validateMovementShape({
        transactionType: "TRANSFER",
        quantity: 1,
        fromLocationId: LOCATION_A,
        toLocationId: LOCATION_A,
      }),
    ).toMatch(/harus berbeda/);
  });
});

describe("movementEffects", () => {
  it("menghitung efek receipt, issue, dan transfer", () => {
    expect(
      movementEffects({ transactionType: "RECEIPT", quantity: 5, toLocationId: LOCATION_A }, 5),
    ).toEqual([{ locationId: LOCATION_A, onHandDelta: 5, reservedDelta: 0 }]);

    expect(
      movementEffects({ transactionType: "ISSUE", quantity: 3, fromLocationId: LOCATION_A }, 3),
    ).toEqual([{ locationId: LOCATION_A, onHandDelta: -3, reservedDelta: 0 }]);

    expect(
      movementEffects(
        {
          transactionType: "TRANSFER",
          quantity: 2,
          fromLocationId: LOCATION_A,
          toLocationId: LOCATION_B,
        },
        2,
      ),
    ).toEqual([
      { locationId: LOCATION_A, onHandDelta: -2, reservedDelta: 0 },
      { locationId: LOCATION_B, onHandDelta: 2, reservedDelta: 0 },
    ]);
  });

  it("menghitung efek reservasi (tanpa mengubah on_hand)", () => {
    expect(
      movementEffects({ transactionType: "RESERVE", quantity: 4, fromLocationId: LOCATION_A }, 4),
    ).toEqual([{ locationId: LOCATION_A, onHandDelta: 0, reservedDelta: 4 }]);
    expect(
      movementEffects({ transactionType: "UNRESERVE", quantity: 4, fromLocationId: LOCATION_A }, 4),
    ).toEqual([{ locationId: LOCATION_A, onHandDelta: 0, reservedDelta: -4 }]);
  });
});

describe("checkEffectAgainstBalance", () => {
  it("mengizinkan mutasi yang cukup saldonya", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: -5, reservedDelta: 0 };
    expect(checkEffectAgainstBalance(effect, { onHand: 10, reserved: 3 })).toBeNull();
  });

  it("menolak pengeluaran saat saldo tidak cukup", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: -11, reservedDelta: 0 };
    const violation = checkEffectAgainstBalance(effect, { onHand: 10, reserved: 0 });
    expect(violation?.kind).toBe("on_hand_negative");
  });

  it("menolak pengeluaran yang mengambil stok terreservasi", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: -8, reservedDelta: 0 };
    const violation = checkEffectAgainstBalance(effect, { onHand: 10, reserved: 3 });
    expect(violation?.kind).toBe("reserved_exceeds_available");
    if (violation?.kind === "reserved_exceeds_available") {
      expect(violation.available).toBe(7);
      expect(violation.requested).toBe(8);
    }
  });

  it("menolak reservasi melebihi stok tersedia", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: 0, reservedDelta: 8 };
    const violation = checkEffectAgainstBalance(effect, { onHand: 10, reserved: 3 });
    expect(violation?.kind).toBe("reserved_exceeds_available");
  });

  it("menolak pelepasan reservasi melebihi jumlah terreservasi", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: 0, reservedDelta: -4 };
    const violation = checkEffectAgainstBalance(effect, { onHand: 10, reserved: 3 });
    expect(violation?.kind).toBe("reserved_negative");
  });

  it("bebas galat floating point pada desimal (0,1 + 0,2)", () => {
    const effect = { locationId: LOCATION_A, onHandDelta: -0.3, reservedDelta: 0 };
    expect(checkEffectAgainstBalance(effect, { onHand: 0.3, reserved: 0 })).toBeNull();

    const reserve = { locationId: LOCATION_A, onHandDelta: 0, reservedDelta: 0.1 + 0.2 };
    expect(checkEffectAgainstBalance(reserve, { onHand: 0.3, reserved: 0 })).toBeNull();
  });
});

describe("normalisasi kuantitas", () => {
  it("membulatkan ke 4 desimal dan memformat string numeric", () => {
    expect(roundQuantity(1.234567)).toBe(1.2346);
    expect(toQuantityString(2)).toBe("2.0000");
    expect(toQuantityString(0.1 + 0.2)).toBe("0.3000");
    expect(toQuantityString(10.5)).toBe("10.5000");
  });
});

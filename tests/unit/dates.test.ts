import { describe, expect, it } from "vitest";
import { formatDateId, formatDateTimeId, formatTimeId, getDocumentPeriod } from "@/lib/utils/dates";

describe("periode dokumen (kalender Asia/Jakarta)", () => {
  it("menggeser ke bulan berikutnya setelah tengah malam WIB", () => {
    // 31 Okt 2026 23:30 UTC = 1 Nov 2026 06:30 WIB
    expect(getDocumentPeriod(new Date("2026-10-31T23:30:00Z"))).toBe("202611");
  });

  it("memakai bulan WIB untuk waktu UTC dini hari", () => {
    // 30 Sep 2026 18:00 UTC = 1 Okt 2026 01:00 WIB
    expect(getDocumentPeriod(new Date("2026-09-30T18:00:00Z"))).toBe("202610");
  });

  it("format selalu YYYYMM", () => {
    const period = getDocumentPeriod(new Date("2026-01-05T00:00:00Z"));
    expect(period).toMatch(/^\d{4}(0[1-9]|1[0-2])$/);
  });
});

describe("format tanggal Indonesia", () => {
  it("formatDateId menampilkan hari, bulan, tahun", () => {
    const formatted = formatDateId(new Date("2026-10-18T05:00:00Z"));
    expect(formatted).toContain("18");
    expect(formatted).toContain("Okt");
    expect(formatted).toContain("2026");
  });

  it("formatDateTimeId selalu berakhiran WIB", () => {
    expect(formatDateTimeId(new Date("2026-10-18T05:00:00Z"))).toMatch(/WIB$/);
  });

  it("formatTimeId memakai jam WIB 24 jam", () => {
    expect(formatTimeId(new Date("2026-10-18T05:00:00Z"))).toBe("12.00");
    expect(formatTimeId(new Date("2026-10-18T17:05:00Z"))).toBe("00.05");
  });

  it("menerima ISO string dan number", () => {
    expect(formatDateId("2026-10-18T05:00:00Z")).toContain("2026");
    expect(formatDateId(Date.parse("2026-10-18T05:00:00Z"))).toContain("2026");
  });
});

import { describe, expect, it } from "vitest";
import {
  BPJS,
  PTKP_BY_STATUS,
  computePayrollLine,
  countWeekdays,
  overlapWeekdays,
  progressiveTax,
} from "@/modules/payroll/calc";

describe("kalkulasi payroll", () => {
  it("menghitung gaji bruto, lembur, potongan tidak dibayar, BPJS, dan PPh 21", () => {
    const line = computePayrollLine({
      basicSalary: 10_000_000,
      fixedAllowance: 1_000_000,
      overtimeHours: 10,
      unpaidDays: 2,
      taxStatus: "TK/0",
    });

    expect(line.overtimePay).toBeCloseTo(867_052.02, 2);
    expect(line.gross).toBeCloseTo(11_867_052.02, 2);
    expect(line.unpaidLeaveDeduction).toBe(1_000_000);
    expect(line.bpjsKesehatanEmployee).toBe(100_000);
    expect(line.bpjsJhtEmployee).toBe(200_000);
    expect(line.bpjsJpEmployee).toBe(100_000);
    expect(line.pph21).toBeCloseTo(395_057.8, 2);
    expect(line.totalDeductions).toBeCloseTo(1_795_057.8, 2);
    expect(line.net).toBeCloseTo(10_071_994.22, 2);
    expect(line.totalEmployerContributions).toBe(1_024_000);
  });

  it("menerapkan batas upah BPJS Kesehatan dan JP", () => {
    const line = computePayrollLine({
      basicSalary: 20_000_000,
      fixedAllowance: 0,
      overtimeHours: 0,
      unpaidDays: 0,
      taxStatus: "TK/0",
    });

    expect(line.bpjsKesehatanEmployee).toBe(120_000);
    expect(line.employerBpjsKesehatan).toBe(480_000);
    expect(line.bpjsJpEmployee).toBe(105_000);
    expect(line.employerBpjsJp).toBe(210_000);
    expect(line.bpjsJhtEmployee).toBe(400_000);
    expect(line.employerBpjsJht).toBe(740_000);
  });

  it("memakai PTKP sesuai status dan tarif progresif", () => {
    expect(PTKP_BY_STATUS["K/2"]).toBe(67_500_000);
    expect(progressiveTax(0)).toBe(0);
    expect(progressiveTax(60_000_000)).toBe(3_000_000);
    expect(progressiveTax(71_604_624.24)).toBeCloseTo(4_740_693.64, 2);
    expect(progressiveTax(300_000_000)).toBeCloseTo(44_000_000, 2);
  });

  it("tidak menghasilkan neto negatif", () => {
    const line = computePayrollLine({
      basicSalary: 100_000,
      fixedAllowance: 0,
      overtimeHours: 0,
      unpaidDays: 22,
      taxStatus: "TK/0",
    });
    expect(line.net).toBe(0);
    expect(line.totalDeductions).toBeGreaterThan(0);
  });

  it("menghitung hari kerja dan irisan cuti", () => {
    expect(countWeekdays("2026-10-19", "2026-10-23")).toBe(5);
    expect(countWeekdays("2026-10-24", "2026-10-25")).toBe(0);
    expect(overlapWeekdays("2026-09-28", "2026-10-02", "2026-10-01", "2026-10-31")).toBe(2);
  });

  it("memakai tarif BPJS default yang terdokumentasi", () => {
    expect(BPJS.kesehatanEmployee).toBe(0.01);
    expect(BPJS.kesehatanEmployer).toBe(0.04);
    expect(BPJS.jhtEmployee).toBe(0.02);
    expect(BPJS.jpCap).toBe(10_500_000);
  });
});

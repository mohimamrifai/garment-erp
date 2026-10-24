/**
 * Kalkulasi payroll bulanan (F7).
 *
 * Asumsi yang dipakai dan ditampilkan di slip:
 * - 1 bulan = 22 hari kerja untuk potongan absensi/cuti tidak dibayar.
 * - Lembur = (gaji pokok / 173) x 1,5 x jam lembur.
 * - BPJS Kesehatan 1% karyawan / 4% perusahaan, batas upah 12 juta.
 * - BPJS JHT 2% karyawan / 3,7% perusahaan.
 * - BPJS JP 1% karyawan / 2% perusahaan, batas upah 10,5 juta.
 * - JKK 0,24% dan JKM 0,30% ditanggung perusahaan.
 * - PPh 21 disetahunkan dengan PTKP dan tarif progresif, lalu dibagi 12.
 *
 * Tarif dapat berubah mengikuti regulasi; nilai di sini adalah default yang
 * dapat diuji dan mudah disesuaikan.
 */

export const TAX_STATUSES = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export const PTKP_BY_STATUS: Readonly<Record<TaxStatus, number>> = {
  "TK/0": 54_000_000,
  "TK/1": 58_500_000,
  "TK/2": 63_000_000,
  "TK/3": 67_500_000,
  "K/0": 58_500_000,
  "K/1": 63_000_000,
  "K/2": 67_500_000,
  "K/3": 72_000_000,
};

export const BPJS = {
  kesehatanEmployee: 0.01,
  kesehatanEmployer: 0.04,
  kesehatanCap: 12_000_000,
  jhtEmployee: 0.02,
  jhtEmployer: 0.037,
  jpEmployee: 0.01,
  jpEmployer: 0.02,
  jpCap: 10_500_000,
  jkk: 0.0024,
  jkm: 0.003,
} as const;

export const WORK_DAYS_PER_MONTH = 22;
export const OVERTIME_DIVISOR = 173;
export const OVERTIME_MULTIPLIER = 1.5;

export type PayrollLineInput = {
  basicSalary: number;
  fixedAllowance: number;
  overtimeHours: number;
  unpaidDays: number;
  taxStatus: TaxStatus;
  otherDeductions?: number;
};

export type PayrollLine = {
  basicSalary: number;
  fixedAllowance: number;
  overtimeHours: number;
  overtimePay: number;
  gross: number;
  unpaidDays: number;
  unpaidLeaveDeduction: number;
  bpjsKesehatanEmployee: number;
  bpjsJhtEmployee: number;
  bpjsJpEmployee: number;
  pph21: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  employerBpjsKesehatan: number;
  employerBpjsJht: number;
  employerBpjsJp: number;
  employerJkk: number;
  employerJkm: number;
  totalEmployerContributions: number;
  taxableGross: number;
  annualTaxableIncome: number;
  ptkp: number;
  details: Record<string, unknown>;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Tarif progresif PPh 21 orang pribadi (lapisan tahunan). */
export function progressiveTax(pkp: number): number {
  const brackets = [
    { limit: 60_000_000, rate: 0.05 },
    { limit: 250_000_000, rate: 0.15 },
    { limit: 500_000_000, rate: 0.25 },
    { limit: 5_000_000_000, rate: 0.3 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
  ];
  let remaining = Math.max(0, pkp);
  let previous = 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const width = bracket.limit - previous;
    const taxable = Math.min(remaining, width);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    previous = bracket.limit;
  }
  return roundMoney(tax);
}

export function computePayrollLine(input: PayrollLineInput): PayrollLine {
  const basicSalary = Math.max(0, roundMoney(input.basicSalary));
  const fixedAllowance = Math.max(0, roundMoney(input.fixedAllowance));
  const overtimeHours = Math.max(0, input.overtimeHours);
  const unpaidDays = Math.max(0, input.unpaidDays);
  const otherDeductions = Math.max(0, roundMoney(input.otherDeductions ?? 0));

  const dailyRate = (basicSalary + fixedAllowance) / WORK_DAYS_PER_MONTH;
  const unpaidLeaveDeduction = roundMoney(dailyRate * unpaidDays);
  const overtimePay = roundMoney(
    (basicSalary / OVERTIME_DIVISOR) * OVERTIME_MULTIPLIER * overtimeHours,
  );
  const gross = roundMoney(basicSalary + fixedAllowance + overtimePay);
  const taxableGross = Math.max(0, roundMoney(gross - unpaidLeaveDeduction));

  const kesehatanBase = Math.min(basicSalary, BPJS.kesehatanCap);
  const jpBase = Math.min(basicSalary, BPJS.jpCap);

  const bpjsKesehatanEmployee = roundMoney(kesehatanBase * BPJS.kesehatanEmployee);
  const bpjsJhtEmployee = roundMoney(basicSalary * BPJS.jhtEmployee);
  const bpjsJpEmployee = roundMoney(jpBase * BPJS.jpEmployee);
  const employerBpjsKesehatan = roundMoney(kesehatanBase * BPJS.kesehatanEmployer);
  const employerBpjsJht = roundMoney(basicSalary * BPJS.jhtEmployer);
  const employerBpjsJp = roundMoney(jpBase * BPJS.jpEmployer);
  const employerJkk = roundMoney(basicSalary * BPJS.jkk);
  const employerJkm = roundMoney(basicSalary * BPJS.jkm);

  const annualGross = roundMoney(taxableGross * 12);
  const annualEmployeeBpjs = roundMoney(
    (bpjsKesehatanEmployee + bpjsJhtEmployee + bpjsJpEmployee) * 12,
  );
  const ptkp = PTKP_BY_STATUS[input.taxStatus] ?? PTKP_BY_STATUS["TK/0"];
  const annualTaxableIncome = Math.max(0, roundMoney(annualGross - annualEmployeeBpjs - ptkp));
  const pph21 = roundMoney(progressiveTax(annualTaxableIncome) / 12);

  const totalDeductions = roundMoney(
    unpaidLeaveDeduction +
      bpjsKesehatanEmployee +
      bpjsJhtEmployee +
      bpjsJpEmployee +
      pph21 +
      otherDeductions,
  );
  const net = Math.max(0, roundMoney(gross - totalDeductions));
  const totalEmployerContributions = roundMoney(
    employerBpjsKesehatan +
      employerBpjsJht +
      employerBpjsJp +
      employerJkk +
      employerJkm,
  );

  return {
    basicSalary,
    fixedAllowance,
    overtimeHours: roundMoney(overtimeHours),
    overtimePay,
    gross,
    unpaidDays,
    unpaidLeaveDeduction,
    bpjsKesehatanEmployee,
    bpjsJhtEmployee,
    bpjsJpEmployee,
    pph21,
    otherDeductions,
    totalDeductions,
    net,
    employerBpjsKesehatan,
    employerBpjsJht,
    employerBpjsJp,
    employerJkk,
    employerJkm,
    totalEmployerContributions,
    taxableGross,
    annualTaxableIncome,
    ptkp,
    details: {
      workDaysPerMonth: WORK_DAYS_PER_MONTH,
      overtimeDivisor: OVERTIME_DIVISOR,
      overtimeMultiplier: OVERTIME_MULTIPLIER,
      ptkp,
      annualGross,
      annualEmployeeBpjs,
      annualTaxableIncome,
      rates: {
        bpjsKesehatanEmployee: BPJS.kesehatanEmployee,
        bpjsJhtEmployee: BPJS.jhtEmployee,
        bpjsJpEmployee: BPJS.jpEmployee,
        bpjsKesehatanEmployer: BPJS.kesehatanEmployer,
        bpjsJhtEmployer: BPJS.jhtEmployer,
        bpjsJpEmployer: BPJS.jpEmployer,
        jkk: BPJS.jkk,
        jkm: BPJS.jkm,
      },
    },
  };
}

/** Hitung hari kerja Senin–Jumat dalam rentang tanggal inklusif. */
export function countWeekdays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let days = 0;
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return days;
}

/** Irisan hari kerja antara rentang cuti dan periode payroll. */
export function overlapWeekdays(
  startDate: string,
  endDate: string,
  periodStart: string,
  periodEnd: string,
): number {
  const start = startDate > periodStart ? startDate : periodStart;
  const end = endDate < periodEnd ? endDate : periodEnd;
  if (start > end) return 0;
  return countWeekdays(start, end);
}

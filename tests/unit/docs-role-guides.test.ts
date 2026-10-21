import { describe, expect, it } from "vitest";
import { ROLE_CODES } from "@/lib/permissions";
import { ROLE_GUIDES } from "@/app/(dashboard)/docs/_data/role-guides";

describe("panduan dokumentasi per role", () => {
  it("mencakup seluruh role tepat satu kali", () => {
    expect(ROLE_GUIDES.map((guide) => guide.code).sort()).toEqual([...ROLE_CODES].sort());
    expect(new Set(ROLE_GUIDES.map((guide) => guide.code)).size).toBe(ROLE_GUIDES.length);
  });

  it("setiap role memiliki fokus, menu, langkah, dan catatan", () => {
    for (const guide of ROLE_GUIDES) {
      expect(guide.focus.length, guide.code).toBeGreaterThan(0);
      expect(guide.menus.length, guide.code).toBeGreaterThan(0);
      expect(guide.steps.length, guide.code).toBeGreaterThanOrEqual(4);
      expect(guide.note.length, guide.code).toBeGreaterThan(0);

      for (const step of guide.steps) {
        expect(step.title.length, `${guide.code}: ${step.title}`).toBeGreaterThan(0);
        expect(step.detail.length, `${guide.code}: ${step.title}`).toBeGreaterThan(0);
      }
    }
  });
});

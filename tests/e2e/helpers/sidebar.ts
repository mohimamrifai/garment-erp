import { expect, type Locator, type Page } from "@playwright/test";

/** Sidebar desktop (di mobile, locator yang sama menunjuk sheet). */
export function sidebarOf(page: Page): Locator {
  return page.locator('[data-slot="sidebar"]');
}

/**
 * Buka grup sidebar yang diperlukan sampai link tampil.
 * Grup memakai pola accordion: membuka grup lain menutup grup sebelumnya.
 */
export async function revealSidebarLink(sidebar: Locator, name: string): Promise<Locator> {
  const link = sidebar.getByRole("link", { name, exact: true });
  const triggers = sidebar.locator("button[data-sidebar-section]");

  // Sidebar dirender dari data sesi yang streaming; tunggu menu sempat muncul.
  await expect
    .poll(async () => (await link.count()) + (await triggers.count()), { timeout: 20_000 })
    .toBeGreaterThan(0);

  if (await link.isVisible().catch(() => false)) return link;

  const count = await triggers.count();

  for (let index = 0; index < count; index += 1) {
    const trigger = triggers.nth(index);
    if ((await trigger.getAttribute("aria-expanded")) === "true") continue;
    await trigger.click();
    await link.waitFor({ state: "visible", timeout: 1_000 }).catch(() => {});
    if (await link.isVisible().catch(() => false)) return link;
  }

  return link;
}

/** Pastikan link sidebar terlihat, dengan membuka grupnya bila perlu. */
export async function expectSidebarLink(sidebar: Locator, name: string): Promise<void> {
  await expect(
    await revealSidebarLink(sidebar, name),
    `menu "${name}" harus terlihat`,
  ).toBeVisible();
}

import { labelForPath, visibleSections } from "@/components/layout/nav-config";
import type { RoleCode } from "@/lib/permissions";

export type AssistantPageContext = {
  label: string;
  section: string;
};

type PageMatch = {
  href: string;
  label: string;
  section: string;
};

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  return trimmed === "/" ? trimmed : trimmed.replace(/\/+$/, "");
}

function buildPageLabel(pathname: string, href: string, baseLabel: string): string {
  const rest = pathname.slice(href.length).replace(/^\/+/, "");
  if (!rest) return baseLabel;

  const lastSegment = rest.split("/").filter(Boolean).at(-1);
  if (lastSegment === "new") return `${baseLabel} Baru`;
  if (lastSegment === "edit") return `Ubah ${baseLabel}`;
  return `Detail ${baseLabel}`;
}

/**
 * Petakan pathname halaman asal ke konteks modul yang aman.
 *
 * Hanya path yang cocok dengan menu yang terlihat oleh role pengguna yang
 * dipakai. Ini mencegah klien mengirim path halaman yang tidak boleh diakses
 * untuk memancing jawaban yang mengungkap modul tersebut.
 */
export function resolveAssistantPageContext(
  pathname: string,
  roles: readonly RoleCode[],
): AssistantPageContext | null {
  const normalized = normalizePathname(pathname);
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("..") ||
    /[\\?#]/.test(normalized)
  ) {
    return null;
  }

  const matches: PageMatch[] = visibleSections(roles)
    .flatMap((section) =>
      section.items.map((item) => ({
        href: item.href,
        label: labelForPath(item.href) || item.title,
        section: section.label,
      })),
    )
    .filter((item) => normalized === item.href || normalized.startsWith(`${item.href}/`));

  const match = matches.sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return null;

  return {
    label: buildPageLabel(normalized, match.href, match.label),
    section: match.section,
  };
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Factory } from "lucide-react";
import { cn } from "cn";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { roleLabel, type RoleCode } from "@/lib/permissions";
import { visibleSections, type NavItem, type NavSection } from "./nav-config";

export type SessionUserView = {
  name: string;
  email: string;
  roles: RoleCode[];
};

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Tandai hanya menu paling spesifik yang aktif.
 * Contoh: di /inventory/movements, "Inventori" tidak ikut aktif.
 */
function isItemActive(pathname: string, items: readonly NavItem[], href: string): boolean {
  if (!isActivePath(pathname, href)) return false;
  return !items.some(
    (item) =>
      item.href !== href && item.href.startsWith(`${href}/`) && isActivePath(pathname, item.href),
  );
}

function isSectionActive(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => isItemActive(pathname, section.items, item.href));
}

function activeSectionLabel(sections: readonly NavSection[], pathname: string): string | null {
  let active: { label: string; length: number } | null = null;

  for (const section of sections) {
    for (const item of section.items) {
      if (!isItemActive(pathname, section.items, item.href)) continue;
      if (!active || item.href.length > active.length) {
        active = { label: section.label, length: item.href.length };
      }
    }
  }

  return active?.label ?? null;
}

function sectionId(label: string): string {
  return `sidebar-section-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function SidebarNav({ sections, pathname }: { sections: readonly NavSection[]; pathname: string }) {
  const { state, isMobile, setOpen } = useSidebar();
  const [openSection, setOpenSection] = useState<string | null>(() =>
    activeSectionLabel(sections, pathname),
  );

  function toggleSection(label: string) {
    // Saat sidebar dalam mode ikon, klik grup membuka sidebar terlebih dahulu.
    if (state === "collapsed" && !isMobile) {
      setOpen(true);
      setOpenSection(label);
      return;
    }

    setOpenSection((current) => (current === label ? null : label));
  }

  return (
    <>
      {sections.map((section) => {
        if (section.items.length === 1) {
          const item = section.items[0]!;
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isItemActive(pathname, section.items, item.href)}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        }

        const active = isSectionActive(section, pathname);
        const open = openSection === section.label;
        const expanded = open && (state !== "collapsed" || isMobile);
        const id = sectionId(section.label);

        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    aria-expanded={expanded}
                    aria-controls={open ? id : undefined}
                    data-sidebar-section={section.label}
                    data-open={expanded ? "" : undefined}
                    tooltip={section.label}
                    className={cn(
                      "font-medium text-sidebar-foreground/80",
                      active && "text-sidebar-foreground",
                    )}
                  >
                    <section.icon />
                    <span>{section.label}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                        open && "rotate-90",
                      )}
                    />
                  </SidebarMenuButton>

                  {open ? (
                    <SidebarMenuSub id={id}>
                      {section.items.map((item) => {
                        const itemActive = isItemActive(pathname, section.items, item.href);
                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton
                              render={<Link href={item.href} />}
                              isActive={itemActive}
                              aria-current={itemActive ? "page" : undefined}
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}

export function AppSidebar({ user }: { user: SessionUserView }) {
  const pathname = usePathname();
  const sections = visibleSections(user.roles);
  const roleNames = user.roles.map(roleLabel);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} tooltip="Garment ERP">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <Factory className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-mono text-xs font-semibold tracking-[0.08em] uppercase">
                  Garment ERP
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {roleNames.join(", ") || "Tanpa role"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav key={pathname} sections={sections} pathname={pathname} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

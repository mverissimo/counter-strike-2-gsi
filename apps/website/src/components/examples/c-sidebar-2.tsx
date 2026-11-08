"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare02Icon,
  InboxIcon,
  RocketIcon,
  Pulse01Icon,
  Analytics01Icon,
  Shield01Icon,
  SettingsIcon,
  Globe02Icon,
  FlashIcon,
  Database02Icon,
} from "@hugeicons/core-free-icons";

interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  isActive?: boolean;
}

interface Monitor {
  id: string;
  label: string;
  value: string;
  icon: ReactNode;
}

// Each icon is a JSX node whose per-library names are STATIC literals. That is
// the shape `shadcn add` rewrites when it swaps the icon package, so an
// interpolated value would leave it nothing to rewrite.
const NAV: RailItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <HugeiconsIcon icon={DashboardSquare02Icon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "inbox",
    label: "Inbox",
    badge: 12,
    icon: <HugeiconsIcon icon={InboxIcon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "deployments",
    label: "Deployments",
    isActive: true,
    icon: <HugeiconsIcon icon={RocketIcon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: <HugeiconsIcon icon={Pulse01Icon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "audit",
    label: "Audit log",
    icon: <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <HugeiconsIcon icon={SettingsIcon} strokeWidth={2} aria-hidden="true" />,
  },
];

const MONITORS: Monitor[] = [
  {
    id: "edge",
    label: "Edge network",
    value: "99.99%",
    icon: (
      <HugeiconsIcon
        icon={Globe02Icon}
        strokeWidth={2}
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    ),
  },
  {
    id: "webhooks",
    label: "Webhook delivery",
    value: "42ms p95",
    icon: (
      <HugeiconsIcon
        icon={FlashIcon}
        strokeWidth={2}
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    ),
  },
  {
    id: "jobs",
    label: "Background jobs",
    value: "12 queued",
    icon: (
      <HugeiconsIcon
        icon={Database02Icon}
        strokeWidth={2}
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    ),
  },
];

// The rail itself. Two things the primitive already handles, so nothing here
// has to: the button clips its own label at a 3rem width instead of removing
// it, so the accessible name survives the collapse, and SidebarMenuBadge
// carries `group-data-[collapsible=icon]:hidden`, so counts disappear with the
// labels rather than stacking on top of an icon.
//
// `tooltip` is the other half of that bargain. The primitive renders it with
// `hidden` until `state` is collapsed, so it costs nothing while the labels
// are on screen and becomes the only name a mouse user sees once they are not.
function RailNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {NAV.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                render={<a href="#" />}
                isActive={item.isActive ?? false}
                tooltip={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
              </SidebarMenuButton>
              {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// The ReUI mark, the same path data the App Shell Pro blocks use. An inline
// SVG on `currentColor` rather than an <img> or an icon-package import: it
// ships inside the example, needs no asset and recolours with the panel.
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-sidebar-primary text-sidebar-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md",
        className,
      )}
    >
      <svg
        viewBox="25.5002 25.1352 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-3"
      >
        <circle cx="70.634" cy="29.8334" r="4.69799" fill="currentColor" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M25.668 57.0144V29.8332C25.668 27.2386 27.7713 25.1352 30.366 25.1352C32.9606 25.1352 35.0639 27.2386 35.0639 29.8332V57.0144C35.0639 61.833 38.9702 65.7392 43.7888 65.7392H57.2116C62.0302 65.7392 65.9364 61.833 65.9364 57.0144V43.7258C65.9364 41.1312 68.0398 39.0278 70.6344 39.0278C73.229 39.0278 75.3324 41.1312 75.3324 43.7258V57.0144C75.3324 67.0222 67.2194 75.1352 57.2116 75.1352H43.7888C33.7809 75.1352 25.668 67.0222 25.668 57.0144Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

// The mark is BrandMark, the same inline SVG the other sidebar examples carry,
// scaled at the call site from its 24px default to the 32px tile sidebar-08
// gives a `size="lg"` header row.
//
// `size="lg"` is what makes that tile survive the collapse: every menu button
// is forced to `size-8` on the rail, and large is the one size that zeroes the
// padding there in all eight styles, so a 32px tile fills it exactly.
// `group-data-[collapsible=icon]:sr-only` on the name block is the other half.
// It leaves the flex line, and takes the 8px gap with it, while keeping the
// button's accessible name, so the tile is the only child left and sits on the
// rail's axis with nothing needed to centre it.
function BrandButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip="ReUI Labs" render={<a href="#" />}>
          <BrandMark className="size-8 rounded-lg [&>svg]:size-4" />
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
            <span className="truncate text-sm font-medium">ReUI Labs</span>
            <span className="text-sidebar-foreground/70 truncate text-xs">Production</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// The same collapsed-rail treatment as the brand mark, with the avatar sized
// to match it. Avatar's default is 32px, which is both what sidebar-07's
// footer row uses and what fills the collapsed button edge to edge.
function AccountButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip="Nadia Rahman" render={<a href="#" />}>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="" />
            <AvatarFallback>NR</AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
            <span className="truncate text-sm font-medium">Nadia Rahman</span>
            <span className="text-sidebar-foreground/70 truncate text-xs">Owner</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// A rail that collapses to icons, and the two controls that drive it.
//
// The collapsed width is the provider's own `--sidebar-width-icon` (3rem), and
// the open state lives in SidebarProvider, so nothing here mirrors it: both
// controls call the same context.
//
// SidebarTrigger sits in the inset rather than in the panel because it is the
// only control that survives both branches. shadcn's Sidebar renders its
// desktop rail behind `hidden md:block` and swaps to a Sheet under 768px, and
// SidebarRail is `sm:flex` against that desktop wrapper, so on a narrow frame
// the trigger in the header is what opens the navigation at all.
//
// `min-h-0` beside the height is load-bearing. SidebarProvider ships
// `min-h-svh`, and tailwind-merge only drops it when another `min-h-*` arrives
// with it, so without the pair this shell is viewport tall wherever it lands.
//
// `absolute h-full` on the Sidebar is the other half of that. The desktop
// branch's panel ships `fixed inset-y-0 h-svh`, and a fixed box ignores both
// the height above and the ancestor's overflow, so it would size and position
// against the VIEWPORT and paint down the page beside a 468px shell. The
// className lands on that container and tailwind-merge swaps both groups, and
// `relative` on the provider is what the panel then measures itself against.
// The mobile branch is untouched: it renders a Sheet and never forwards
// className to it.
export function Pattern() {
  return (
    <SidebarProvider className="relative h-dvh min-h-0 w-full overflow-hidden">
      <Sidebar collapsible="icon" className="absolute h-full">
        <SidebarHeader>
          <BrandButton />
        </SidebarHeader>

        <SidebarContent role="navigation" aria-label="Primary">
          <RailNav />
        </SidebarContent>

        <SidebarFooter>
          <AccountButton />
        </SidebarFooter>

        {/*
          SidebarRail ships its own `tabIndex={-1}` and `aria-label`, so the
          grab strip on the panel edge is a mouse affordance and the trigger in
          the inset header is the keyboard path. Two tab stops for one toggle
          would only slow a keyboard user down.
        */}
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <h2 className="truncate text-sm font-medium">Deployments</h2>
          <Button variant="outline" size="sm" className="ml-auto">
            New deploy
          </Button>
        </header>

        <div className="min-w-0 flex-1 overflow-auto p-4">
          <p className="text-muted-foreground max-w-prose text-sm">
            Every deploy runs against the edge network first. Collapse the rail with the panel
            button or the strip on its edge, and the labels give way to tooltips.
          </p>

          <dl className="mt-4 flex flex-col gap-3">
            {MONITORS.map((monitor) => (
              <div key={monitor.id} className="flex items-center gap-2 text-sm">
                <dt className="flex min-w-0 flex-1 items-center gap-2">
                  {monitor.icon}
                  <span className="truncate">{monitor.label}</span>
                </dt>
                <dd className="shrink-0 tabular-nums">{monitor.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

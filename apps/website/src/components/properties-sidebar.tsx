import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarRightIcon } from "@hugeicons/core-free-icons";
import { ElementProperties } from "@/components/element-properties";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarHeader } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function PropertiesSidebar() {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return (
    <>
      {!open && (
        <Button
          variant="secondary"
          size="icon-sm"
          className="absolute top-16 right-4 z-20 hidden lg:inline-flex"
          aria-label="Show properties"
          title="Show properties"
          onClick={() => setOpen(true)}
        >
          <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={1.5} />
        </Button>
      )}
      <Button
        variant="secondary"
        size="icon-sm"
        className="absolute top-16 right-3 z-20 lg:hidden"
        aria-label="Show properties"
        title="Show properties"
        onClick={() => setMobileOpen(true)}
      >
        <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={1.5} />
      </Button>
      {open && (
        <Sidebar
          collapsible="none"
          side="right"
          role="complementary"
          aria-label="Element properties"
          className="hidden h-full w-70! shrink-0 border-l bg-sidebar lg:flex"
        >
          <SidebarHeader className="h-12 shrink-0 flex-row items-center justify-between border-b px-4 py-0">
            <h2 className="text-xs font-semibold">Properties</h2>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Hide properties"
              title="Hide properties"
              onClick={() => setOpen(false)}
            >
              <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={1.5} />
            </Button>
          </SidebarHeader>
          <ElementProperties />
        </Sidebar>
      )}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="gap-0 data-[side=right]:w-[min(280px,100vw)]">
          <div className="flex h-12 shrink-0 items-center border-b px-4">
            <SheetTitle className="text-xs font-semibold">Properties</SheetTitle>
            <SheetDescription className="sr-only">Edit the selected HUD element.</SheetDescription>
          </div>
          <ElementProperties />
        </SheetContent>
      </Sheet>
    </>
  );
}

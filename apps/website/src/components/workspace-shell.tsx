import { Link, useLocation } from "@tanstack/react-router";
import { navigation } from "@/shared/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorProvider } from "@/components/editor-context";
import { EditorWorkspace } from "@/components/editor-workspace";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

function WorkspaceNavigationToggle({ isEditor }: { isEditor: boolean }) {
  const { open } = useSidebar();
  const className = isEditor && !open ? "" : "md:hidden";
  return (
    <>
      <SidebarTrigger className={`-ml-1 ${className}`} />
      <Separator
        orientation="vertical"
        className={`mr-2 data-[orientation=vertical]:h-4 ${className}`}
      />
    </>
  );
}

export function WorkspaceShell() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isEditor = pathname === "/editor";
  const activeItem = navigation.find((item) => item.url === pathname);
  return (
    <EditorProvider>
      <TooltipProvider>
        <SidebarProvider
          className={isEditor ? "h-dvh min-h-0 overflow-hidden" : undefined}
          style={
            {
              "--sidebar-width": isEditor
                ? "calc(var(--sidebar-width-icon) + 240px)"
                : "var(--sidebar-width-icon)",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <SidebarInset className={isEditor ? "min-w-0 overflow-hidden" : undefined}>
            {isEditor ? (
              <EditorWorkspace navigationToggle={<WorkspaceNavigationToggle isEditor />} />
            ) : (
              <>
                <header className="sticky top-0 flex shrink-0 items-center h-12 gap-2 border-b bg-background px-4">
                  <WorkspaceNavigationToggle isEditor={isEditor} />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink render={<Link to="/huds" />}>
                          {activeItem?.group ?? "Workspace"}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{activeItem?.title ?? "hud.studio"}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  {Array.from({ length: 24 }).map((_, index) => (
                    <div key={index} className="aspect-video h-12 w-full rounded-lg bg-muted/50" />
                  ))}
                </div>
              </>
            )}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </EditorProvider>
  );
}

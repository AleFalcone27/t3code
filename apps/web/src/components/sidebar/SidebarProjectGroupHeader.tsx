import { useSidebarTreeRow } from "./useSidebarTreeDrag";
import { ChevronDownIcon, FolderIcon, MoreHorizontalIcon } from "lucide-react";
import type { SidebarProjectFolder } from "../../sidebarProjectFolders";
import { projectIconColorClassName } from "../../projectIconColors";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";

export function sidebarProjectGroupRowId(id: string) {
  return `project-group:${id}`;
}

export function SidebarProjectGroupHeader({
  folder,
  count,
  dragEnabled = false,
  onToggle,
  onContextMenu,
}: {
  dragEnabled?: boolean | undefined;
  folder: SidebarProjectFolder;
  count: number;
  onToggle: () => void;
  onContextMenu: (position: { x: number; y: number }) => void;
}) {
  const rowId = sidebarProjectGroupRowId(folder.id);
  const { className: dragClassName, ...dragProps } = useSidebarTreeRow(rowId, dragEnabled);
  return (
    <li
      className="group/project-group relative mt-2 list-none first:mt-0"
      data-testid="sidebar-project-group"
    >
      <button
        {...dragProps}
        type="button"
        data-sidebar-row={rowId}
        aria-expanded={!folder.collapsed}
        onClick={onToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu({ x: event.clientX, y: event.clientY });
        }}
        className={cn(
          "flex h-8 w-full cursor-pointer select-none items-center gap-2.5 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          dragClassName,
        )}
      >
        <FolderIcon
          aria-hidden
          className={cn("size-4 shrink-0", projectIconColorClassName(folder.color))}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground/90">
          {folder.name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-sidebar-muted-foreground group-hover/project-group:invisible group-focus-within/project-group:invisible pointer-coarse:invisible">
          {count}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-3 shrink-0 text-sidebar-muted-foreground",
            folder.collapsed && "-rotate-90",
          )}
        />
      </button>
      <span className="absolute inset-y-0 right-6 flex items-center opacity-0 focus-within:opacity-100 group-hover/project-group:opacity-100 pointer-coarse:opacity-100">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost-muted"
          data-sidebar-action-for={rowId}
          aria-label={`Folder options for ${folder.name}`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onContextMenu({ x: rect.left, y: rect.bottom });
          }}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </span>
    </li>
  );
}

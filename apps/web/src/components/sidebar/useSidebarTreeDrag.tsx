import {
  pointerWithin,
  useDraggable,
  useDroppable,
  type CollisionDescriptor,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { useState } from "react";
import {
  resolveSidebarTreeTarget,
  sidebarTreeDropPosition,
  type SidebarTreeDrop,
  type SidebarTreeItem,
} from "../../sidebarOrganization";
import { cn } from "~/lib/utils";

export const SIDEBAR_PROJECT_ROOT_DROP_ID = "sidebar-project-root";

/** Pointer slack, in px, that still counts as hovering the nearest row (gaps between rows). */
const DROP_GAP = 16;
const PARENT_ATTRIBUTE = "data-sidebar-parent";
const ROW_ATTRIBUTE = "data-sidebar-row";

type DropMark =
  | { kind: "line"; top: number; left: number; width: number }
  | { kind: "box"; top: number; left: number; width: number; height: number };

type ResolvedDrop = { item: SidebarTreeItem; position: SidebarTreeDrop["position"] };

export function useSidebarTreeRow(id: string, enabled: boolean) {
  const draggable = useDraggable({ id, disabled: !enabled });
  const droppable = useDroppable({ id, disabled: !enabled });
  return {
    ref: (node: HTMLButtonElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    ...draggable.listeners,
    ...(enabled ? { ...draggable.attributes, "aria-disabled": undefined } : {}),
    className: cn(enabled && "touch-none", draggable.isDragging && "opacity-40"),
  };
}

export function SidebarProjectRootDrop({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: SIDEBAR_PROJECT_ROOT_DROP_ID,
    disabled: !visible,
  });
  if (!visible) return null;
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "my-2 list-none rounded-md border border-dashed border-sidebar-border px-3 py-3 text-xs text-sidebar-muted-foreground",
        isOver && "border-primary/60 bg-primary/10 text-sidebar-foreground",
      )}
    >
      Drop here to move a project out of its folder
    </li>
  );
}

/** Where the drop would land: a line between rows, or a box around the row that takes it. */
export function SidebarTreeDropMarks({ marks }: { marks: readonly DropMark[] }) {
  if (marks.length === 0) return null;
  return (
    <li aria-hidden className="pointer-events-none absolute inset-0 z-30 list-none">
      {marks.map((mark) =>
        mark.kind === "line" ? (
          <div
            key={`line:${mark.top}:${mark.left}`}
            data-testid="sidebar-drop-line"
            className="absolute h-0.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ top: mark.top, left: mark.left, width: mark.width }}
          />
        ) : (
          <div
            key={`box:${mark.top}:${mark.left}`}
            data-testid="sidebar-drop-box"
            className="absolute rounded-(--control-radius) bg-primary/10 ring-2 ring-inset ring-primary/60"
            style={{ top: mark.top, left: mark.left, width: mark.width, height: mark.height }}
          />
        ),
      )}
    </li>
  );
}

/** Parks the ghost below and right of the pointer so it never covers the row being targeted. */
export const sidebarTreeGhostOffset: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!(activatorEvent instanceof PointerEvent) || !activeNodeRect) return transform;
  return {
    ...transform,
    x: transform.x + activatorEvent.clientX - activeNodeRect.left + 12,
    y: transform.y + activatorEvent.clientY - activeNodeRect.top + 10,
  };
};

/** What follows the pointer while a row is dragged; the row itself stays in place, dimmed. */
export function SidebarTreeDragGhost({ label }: { label: string }) {
  return (
    <div className="flex h-full w-fit max-w-full cursor-grabbing items-center rounded-(--control-radius) border border-primary/40 bg-sidebar px-(--sidebar-row-content-inset) text-sm font-medium text-sidebar-foreground shadow-lg">
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
}

function rowElement(node: HTMLElement | null | undefined) {
  if (!node) return null;
  return node.matches(`[${ROW_ATTRIBUTE}]`)
    ? node
    : node.querySelector<HTMLElement>(`[${ROW_ATTRIBUTE}]`);
}

function measureDropMarks(
  container: HTMLElement,
  id: string,
  position: SidebarTreeDrop["position"],
): DropMark[] {
  const origin = container.getBoundingClientRect();
  const rows = new Map<string, HTMLElement>();
  for (const row of container.querySelectorAll<HTMLElement>(`[${ROW_ATTRIBUTE}]`))
    rows.set(row.getAttribute(ROW_ATTRIBUTE)!, row);
  const header = rows.get(id);
  if (!header) return [];
  const isWithin = (rowId: string) => {
    let current: string | null = rowId;
    for (let depth = 0; current !== null && depth < 5; depth += 1) {
      if (current === id) return true;
      current = rows.get(current)?.getAttribute(PARENT_ATTRIBUTE) ?? null;
    }
    return false;
  };
  const descendants = [...rows].filter(([rowId]) => rowId !== id && isWithin(rowId));
  const own = header.getBoundingClientRect();
  const blockBottom = Math.max(
    own.bottom,
    ...descendants.map(([, row]) => row.getBoundingClientRect().bottom),
  );
  const left = own.left - origin.left;
  if (position === "before")
    return [{ kind: "line", top: own.top - origin.top - 1, left, width: own.width }];
  if (position === "after")
    return [{ kind: "line", top: blockBottom - origin.top + 1, left, width: own.width }];
  const marks: DropMark[] = [
    { kind: "box", top: own.top - origin.top, left, width: own.width, height: own.height },
  ];
  const lastChild = descendants
    .filter(([, row]) => row.getAttribute(PARENT_ATTRIBUTE) === id)
    .at(-1);
  if (lastChild) {
    const child = lastChild[1].getBoundingClientRect();
    marks.push({
      kind: "line",
      top: blockBottom - origin.top + 1,
      left: child.left - origin.left,
      width: child.width,
    });
  }
  return marks;
}

export function useSidebarTreeDrag(input: {
  enabled: boolean;
  item: (id: string) => SidebarTreeItem | null;
  canDrop: (source: SidebarTreeItem, target: SidebarTreeItem) => boolean;
  onDrop: (drop: SidebarTreeDrop) => void;
  /** The element the rows live in; drop marks are positioned inside it. */
  container: () => HTMLElement | null;
}) {
  const [active, setActive] = useState<SidebarTreeItem | null>(null);
  const [drop, setDrop] = useState<{
    id: string;
    position: SidebarTreeDrop["position"];
    marks: DropMark[];
  } | null>(null);

  const collisionDetection: CollisionDetection = (args) => {
    const pointer = args.pointerCoordinates;
    const sourceId = String(args.active.id);
    const source = input.item(sourceId);
    if (source === null || pointer === null) return [];
    const containers = new Map(args.droppableContainers.map((entry) => [String(entry.id), entry]));
    const parentOf = (id: string) =>
      rowElement(containers.get(id)?.node.current)?.getAttribute(PARENT_ATTRIBUTE) ?? null;
    const resolve = (hitId: string) =>
      resolveSidebarTreeTarget({
        sourceId,
        hitId,
        parentOf,
        item: input.item,
        canDrop: input.canDrop,
      });
    let target: { id: string; item: SidebarTreeItem } | null = null;
    for (const hit of pointerWithin(args)) {
      target = resolve(String(hit.id));
      if (target) break;
    }
    if (target === null) {
      // The pointer is in a gap between rows: take the nearest row that accepts the drop.
      let nearest = Number.POSITIVE_INFINITY;
      for (const id of containers.keys()) {
        const rect = args.droppableRects.get(id);
        if (!rect || pointer.x < rect.left || pointer.x > rect.right) continue;
        const distance = Math.max(rect.top - pointer.y, pointer.y - rect.bottom, 0);
        if (distance > DROP_GAP || distance >= nearest) continue;
        const resolved = resolve(id);
        if (!resolved) continue;
        nearest = distance;
        target = resolved;
      }
    }
    if (target === null) return [];
    const rect = args.droppableRects.get(target.id);
    if (!rect) return [];
    let bottom = rect.bottom;
    if (source.kind !== "thread" && target.item.kind !== "root") {
      for (const id of containers.keys()) {
        let current: string | null = id;
        for (let depth = 0; current !== null && depth < 4; depth += 1) {
          if (current === target.id) {
            bottom = Math.max(bottom, args.droppableRects.get(id)?.bottom ?? bottom);
            break;
          }
          current = parentOf(current);
        }
      }
    }
    const container = containers.get(target.id);
    if (!container) return [];
    const resolved: ResolvedDrop = {
      item: target.item,
      position: sidebarTreeDropPosition({
        source,
        target: target.item,
        pointerY: pointer.y,
        block: { top: rect.top, bottom },
      }),
    };
    const collision: CollisionDescriptor = {
      id: target.id,
      data: { droppableContainer: container, value: 0, resolved },
    };
    return [collision];
  };

  const reset = () => {
    setActive(null);
    setDrop(null);
  };
  const start = (event: DragStartEvent) => {
    if (!input.enabled) return false;
    const item = input.item(String(event.active.id));
    if (item === null) return false;
    setActive(item);
    return true;
  };
  const over = (event: DragMoveEvent) => {
    if (active === null) return;
    const hit = event.collisions?.[0];
    const resolved = hit?.data?.resolved as ResolvedDrop | undefined;
    if (!hit || !resolved) {
      if (drop !== null) setDrop(null);
      return;
    }
    const id = String(hit.id);
    if (drop?.id === id && drop.position === resolved.position) return;
    const container = input.container();
    setDrop({
      id,
      position: resolved.position,
      marks: container ? measureDropMarks(container, id, resolved.position) : [],
    });
  };
  const end = (event: DragEndEvent) => {
    const source = input.enabled ? input.item(String(event.active.id)) : null;
    if (source === null) return false;
    const resolved = event.collisions?.[0]?.data?.resolved as ResolvedDrop | undefined;
    if (resolved && input.canDrop(source, resolved.item))
      input.onDrop({ source, target: resolved.item, position: resolved.position });
    reset();
    return true;
  };
  return { active, marks: drop?.marks ?? [], start, over, end, reset, collisionDetection };
}

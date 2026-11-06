import type { SidebarProjectFolder } from "./sidebarProjectFolders";

export type SidebarTreeItem =
  | { kind: "folder"; key: string }
  | { kind: "project"; key: string }
  | { kind: "thread"; key: string; projectKey: string }
  | { kind: "root"; key: string };
export type SidebarTreeDrop = {
  source: SidebarTreeItem;
  target: SidebarTreeItem;
  position: "before" | "after" | "inside";
};

/**
 * The row a pointer over `hitId` drops on: the row itself, else its closest ancestor that
 * accepts the source. A drag never resolves through itself, so hovering a project's own
 * threads does not turn into a drop on the folder that holds it.
 */
export function resolveSidebarTreeTarget(input: {
  sourceId: string;
  hitId: string;
  parentOf: (id: string) => string | null;
  item: (id: string) => SidebarTreeItem | null;
  canDrop: (source: SidebarTreeItem, target: SidebarTreeItem) => boolean;
}): { id: string; item: SidebarTreeItem } | null {
  const source = input.item(input.sourceId);
  if (source === null) return null;
  let id: string | null = input.hitId;
  for (let depth = 0; id !== null && depth < 4; depth += 1) {
    if (id === input.sourceId) return null;
    const item = input.item(id);
    if (item !== null && input.canDrop(source, item)) return { id, item };
    id = input.parentOf(id);
  }
  return null;
}

/** Where on `target` the source lands; `block` spans the target row and everything under it. */
export function sidebarTreeDropPosition(input: {
  source: SidebarTreeItem;
  target: SidebarTreeItem;
  pointerY: number;
  block: { top: number; bottom: number };
}): SidebarTreeDrop["position"] {
  const { source, target } = input;
  if (target.kind === "root") return "inside";
  if (target.kind === "folder" && source.kind !== "folder") return "inside";
  if (target.kind === "project" && source.kind === "thread") return "inside";
  return input.pointerY < (input.block.top + input.block.bottom) / 2 ? "before" : "after";
}

export function moveSidebarItem<T>(
  items: readonly T[],
  source: T,
  target: T | null,
  after: boolean,
): T[] {
  if (source === target || !items.includes(source)) return [...items];
  const next = items.filter((item) => item !== source);
  const index = target === null ? next.length : next.indexOf(target);
  if (index < 0) return [...items];
  next.splice(index + (after && target !== null ? 1 : 0), 0, source);
  return next;
}

export function moveSidebarProject(input: {
  folders: readonly SidebarProjectFolder[];
  projectKeys: readonly string[];
  drop: SidebarTreeDrop;
}) {
  const { source, target } = input.drop;
  if (source.kind !== "project" || !input.projectKeys.includes(source.key)) return null;
  if (target.kind === "thread" || target.key === source.key) return null;
  const destination =
    target.kind === "folder"
      ? input.folders.find((folder) => folder.id === target.key)
      : target.kind === "project"
        ? input.folders.find((folder) => folder.projectKeys.includes(target.key))
        : undefined;
  if (target.kind === "folder" && !destination) return null;
  const projectKeys = moveSidebarItem(
    input.projectKeys,
    source.key,
    target.kind === "project" ? target.key : null,
    input.drop.position === "after",
  );
  const folders = input.folders.map((folder) => {
    const keys = folder.projectKeys.filter((key) => key !== source.key);
    if (folder !== destination) return { ...folder, projectKeys: keys };
    return { ...folder, collapsed: false, projectKeys: [...keys, source.key] };
  });
  return { folders, projectKeys };
}

export function sidebarThreadDropOrder(
  keys: readonly string[],
  source: string,
  target: string | null,
  after: boolean,
): string[] {
  return moveSidebarItem(keys.includes(source) ? keys : [...keys, source], source, target, after);
}

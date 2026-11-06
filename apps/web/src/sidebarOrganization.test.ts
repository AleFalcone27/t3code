import { describe, expect, it } from "vite-plus/test";
import {
  moveSidebarItem,
  resolveSidebarTreeTarget,
  sidebarTreeDropPosition,
  type SidebarTreeItem,
} from "./sidebarOrganization";

const items = new Map<string, SidebarTreeItem>([
  ["folder-row", { kind: "folder", key: "work" }],
  ["project-row", { kind: "project", key: "alpha" }],
  ["thread-row", { kind: "thread", key: "thread-1", projectKey: "alpha" }],
  ["root", { kind: "root", key: "root" }],
  ["other-project", { kind: "project", key: "beta" }],
  ["other-thread", { kind: "thread", key: "thread-2", projectKey: "beta" }],
]);
const parents = new Map([
  ["thread-row", "project-row"],
  ["project-row", "folder-row"],
]);
const resolve = (sourceId: string, hitId: string) =>
  resolveSidebarTreeTarget({
    sourceId,
    hitId,
    parentOf: (id) => parents.get(id) ?? null,
    item: (id) => items.get(id) ?? null,
    canDrop: (source, target) =>
      source.kind === "project" ? target.kind !== "thread" : target.kind === "thread",
  });

describe("sidebar tree drop", () => {
  it("resolves a hovered row to the nearest ancestor that accepts the source", () => {
    expect(resolve("other-project", "thread-row")?.id).toBe("project-row");
    expect(resolve("other-thread", "thread-row")?.id).toBe("thread-row");
    expect(resolve("other-project", "project-row")?.id).toBe("project-row");
  });

  it("never resolves a drag through the row being dragged", () => {
    expect(resolve("project-row", "thread-row")).toBeNull();
    expect(resolve("project-row", "project-row")).toBeNull();
  });

  it("places a drop before or after the hovered block, or inside a container", () => {
    const [thread, project, folder, root] = ["thread-row", "project-row", "folder-row", "root"].map(
      (id) => items.get(id)!,
    );
    const block = { top: 100, bottom: 200 };
    const position = (source: SidebarTreeItem, target: SidebarTreeItem, pointerY: number) =>
      sidebarTreeDropPosition({ source, target, pointerY, block });
    expect(position(thread!, thread!, 120)).toBe("before");
    expect(position(thread!, thread!, 180)).toBe("after");
    expect(position(project!, project!, 199)).toBe("after");
    expect(position(thread!, project!, 101)).toBe("inside");
    expect(position(project!, folder!, 101)).toBe("inside");
    expect(position(folder!, folder!, 101)).toBe("before");
    expect(position(project!, root!, 101)).toBe("inside");
  });

  it("moves an item next to a target, or to the end", () => {
    expect(moveSidebarItem(["a", "b", "c"], "c", "a", false)).toEqual(["c", "a", "b"]);
    expect(moveSidebarItem(["a", "b", "c"], "a", "b", true)).toEqual(["b", "a", "c"]);
    expect(moveSidebarItem(["a", "b", "c"], "a", null, false)).toEqual(["b", "c", "a"]);
  });
});

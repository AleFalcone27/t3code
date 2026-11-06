import "../../index.css";
import { DndContext, useSensor, useSensors } from "@dnd-kit/core";
import { useRef } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import type { SidebarTreeDrop, SidebarTreeItem } from "../../sidebarOrganization";
import { SidebarPointerSensor } from "../Sidebar.pointer";
import { SidebarTreeDropMarks, useSidebarTreeDrag, useSidebarTreeRow } from "./useSidebarTreeDrag";

const ITEMS = new Map<string, SidebarTreeItem>([
  ["work", { kind: "folder", key: "work" }],
  ["alpha", { kind: "project", key: "alpha" }],
  ["a1", { kind: "thread", key: "a1", projectKey: "alpha" }],
  ["a2", { kind: "thread", key: "a2", projectKey: "alpha" }],
  ["beta", { kind: "project", key: "beta" }],
  ["b1", { kind: "thread", key: "b1", projectKey: "beta" }],
]);
const PARENTS: Record<string, string> = { alpha: "work", a1: "alpha", a2: "alpha", b1: "beta" };

function Row({ id }: { id: string }) {
  const { className, ...row } = useSidebarTreeRow(id, true);
  return (
    <li className="list-none">
      <button
        {...row}
        type="button"
        data-sidebar-row={id}
        data-sidebar-parent={PARENTS[id]}
        className={`block h-8 w-full text-left ${className}`}
      >
        {id}
      </button>
    </li>
  );
}

function Harness({ onDrop }: { onDrop: (drop: SidebarTreeDrop) => void }) {
  const list = useRef<HTMLUListElement | null>(null);
  const drag = useSidebarTreeDrag({
    enabled: true,
    item: (id) => ITEMS.get(id) ?? null,
    canDrop: (source, target) =>
      source.key !== target.key &&
      (source.kind === "thread"
        ? target.kind === "thread" || target.kind === "project"
        : source.kind === "project"
          ? target.kind === "folder" || target.kind === "project"
          : target.kind === "folder"),
    onDrop,
    container: () => list.current,
  });
  const sensors = useSensors(
    useSensor(SidebarPointerSensor, { distance: 4, onAttach: () => {}, onFinish: () => {} }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={drag.collisionDetection}
      onDragStart={drag.start}
      onDragMove={drag.over}
      onDragEnd={drag.end}
      onDragCancel={drag.reset}
    >
      <ul ref={list} className="relative flex w-60 flex-col gap-2">
        {[...ITEMS.keys()]
          .filter((id) => id !== "root")
          .map((id) => (
            <Row key={id} id={id} />
          ))}
        <SidebarTreeDropMarks marks={drag.marks} />
      </ul>
    </DndContext>
  );
}

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-sidebar-row="${id}"]`)!;
const pointer = (type: string, x: number, y: number, buttons: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  });

/**
 * Presses the source row. The pointer keeps moving until the caller's assertion holds,
 * as a hand does: drop targets are measured after the drag starts and only re-checked
 * on movement.
 */
function pressRow(container: HTMLElement, sourceId: string) {
  const start = rowOf(container, sourceId).getBoundingClientRect();
  let at = { x: start.left + 20, y: start.top + start.height / 2 };
  rowOf(container, sourceId).dispatchEvent(pointer("pointerdown", at.x, at.y, 1));
  let nudge = 0;
  return {
    moveTo(x: number, y: number) {
      nudge += 1;
      at = { x, y: y + (nudge % 2) * 0.5 };
      document.dispatchEvent(pointer("pointermove", at.x, at.y, 1));
    },
    release: () => document.dispatchEvent(pointer("pointerup", at.x, at.y, 0)),
  };
}

const marksOf = (container: HTMLElement) => ({
  lines: [...container.querySelectorAll<HTMLElement>('[data-testid="sidebar-drop-line"]')],
  boxes: [...container.querySelectorAll<HTMLElement>('[data-testid="sidebar-drop-box"]')],
});

describe("sidebar tree drag", () => {
  it("shows where a drop lands and applies it, including from the gap between rows", async () => {
    const onDrop = vi.fn();
    await using screen = await render(<Harness onDrop={onDrop} />, { router: false }); // no routing involved
    const { container } = screen;
    const a2 = rowOf(container, "a2").getBoundingClientRect();
    const b1 = rowOf(container, "b1").getBoundingClientRect();

    const lowerHalf = pressRow(container, "a1");
    await vi.waitFor(() => {
      lowerHalf.moveTo(a2.left + 20, a2.top + a2.height * 0.8);
      expect(marksOf(container).lines).toHaveLength(1);
    });
    expect(marksOf(container).lines[0]!.getBoundingClientRect().top).toBeCloseTo(a2.bottom, -1);
    lowerHalf.release();
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop.mock.lastCall?.[0]).toMatchObject({
      source: { key: "a1" },
      target: { key: "a2" },
      position: "after",
    });

    // The gap under b1 belongs to the nearest row, not to nothing.
    const gap = pressRow(container, "a1");
    await vi.waitFor(() => {
      gap.moveTo(b1.left + 20, b1.bottom + 3);
      expect(marksOf(container).lines).toHaveLength(1);
    });
    gap.release();
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledTimes(2));
    expect(onDrop.mock.lastCall?.[0]).toMatchObject({ target: { key: "b1" }, position: "after" });
  });

  it("boxes a project that takes the drop, and never drops a project on its own threads", async () => {
    const onDrop = vi.fn();
    await using screen = await render(<Harness onDrop={onDrop} />, { router: false }); // no routing involved
    const { container } = screen;
    const beta = rowOf(container, "beta").getBoundingClientRect();
    const a1 = rowOf(container, "a1").getBoundingClientRect();

    const onProject = pressRow(container, "a2");
    await vi.waitFor(() => {
      onProject.moveTo(beta.left + 20, beta.top + beta.height / 2);
      expect(marksOf(container).boxes).toHaveLength(1);
    });
    // The thread would go last in beta, below its only thread.
    expect(marksOf(container).lines[0]!.getBoundingClientRect().top).toBeCloseTo(
      rowOf(container, "b1").getBoundingClientRect().bottom,
      -1,
    );
    onProject.release();
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop.mock.lastCall?.[0]).toMatchObject({
      target: { key: "beta" },
      position: "inside",
    });

    const onOwnThread = pressRow(container, "alpha");
    await vi.waitFor(() => {
      onOwnThread.moveTo(a1.left + 20, a1.top + a1.height / 2);
      expect(rowOf(container, "alpha").className).toContain("opacity-40");
    });
    expect(marksOf(container).lines).toHaveLength(0);
    onOwnThread.release();
    await vi.waitFor(() => expect(rowOf(container, "alpha").className).not.toContain("opacity-40"));
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});

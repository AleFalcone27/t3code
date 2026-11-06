import "../index.css";
import { DEFAULT_CLIENT_SETTINGS, EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { act, render } from "../../test/render";
import { openCommandPalette } from "../commandPaletteBus";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { __setClientSettingsForTests, getClientSettings } from "../hooks/useSettings";
import { useProjects } from "../state/entities";
import type { Project } from "../types";
import Sidebar from "./Sidebar";
import {
  useUiStateStore,
  parsePersistedState,
  persistState,
  PERSISTED_STATE_KEY,
} from "../uiStateStore";
import { dismissContextMenu } from "../contextMenuFallback";
import { SidebarProvider, Sidebar as SidebarShell } from "./ui/sidebar";

vi.mock("../state/entities", { spy: true });
vi.mock("../hooks/useHandleNewThread", { spy: true });
vi.mock("../commandPaletteBus", () => ({
  openCommandPalette: vi.fn(),
  isCommandPaletteOpen: () => false,
}));
vi.mock("./sidebar/SidebarChrome", () => ({
  SidebarChromeHeader: () => null,
  SidebarChromeFooter: () => null,
}));

function project(id: string): Project {
  return {
    id: ProjectId.make(id),
    environmentId: EnvironmentId.make("local"),
    title: id,
    workspaceRoot: `/projects/${id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    scripts: [],
  };
}

describe("sidebar header new thread", () => {
  it.each([
    { mode: "normal", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: true, picker: false },
    { mode: "boring", count: 1, shift: false, picker: false },
    { mode: "legacy", count: 2, shift: false, picker: false },
  ] as const)("$mode sidebar, $count projects, shift=$shift: picker=$picker", async (scenario) => {
    using stack = new DisposableStack();
    const previousSettings = getClientSettings();
    stack.defer(() => __setClientSettingsForTests(previousSettings));
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      boringSidebarEnabled: scenario.mode === "boring",
      legacySidebarEnabled: scenario.mode === "legacy",
    });
    const projects = [project("active"), project("idle")].slice(0, scenario.count);
    const currentProjectRef = {
      environmentId: projects[0]!.environmentId,
      projectId: projects[0]!.id,
    };
    const startThread = vi.fn().mockResolvedValue(null);
    vi.mocked(useProjects).mockReturnValue(projects);
    vi.mocked(useHandleNewThread).mockReturnValue({
      activeDraftThread: null,
      activeThread: null,
      defaultProjectRef: currentProjectRef,
      handleNewThread: startThread,
      routeDraftId: null,
      routeThreadRef: null,
    });
    vi.mocked(openCommandPalette).mockClear();
    await using screen = await render(
      <SidebarProvider>
        <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
      </SidebarProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "New thread", exact: true }), {
      modifiers: scenario.shift ? ["Shift"] : [],
    });

    if (scenario.picker) {
      expect(openCommandPalette).toHaveBeenCalledExactlyOnceWith({ open: "new-thread-in" });
      expect(startThread).not.toHaveBeenCalled();
    } else {
      expect(openCommandPalette).not.toHaveBeenCalled();
      expect(startThread).toHaveBeenCalledExactlyOnceWith(currentProjectRef);
    }
  });
});

it("organizes projects into a persistent folder, edits it, and removes the folder safely", async () => {
  using stack = new DisposableStack();
  const previousSettings = getClientSettings();
  const previousUiState = useUiStateStore.getState();
  stack.defer(() => {
    dismissContextMenu();
    __setClientSettingsForTests(previousSettings);
    useUiStateStore.setState(previousUiState);
  });
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    boringSidebarEnabled: true,
    legacySidebarEnabled: false,
    sidebarProjectFoldersEnabled: true,
  });
  useUiStateStore.setState({ sidebarProjectFolders: [], sidebarProjectScopeKeys: [] });
  const projects = [project("math"), project("physics")];
  vi.mocked(useProjects).mockReturnValue(projects);
  vi.mocked(useHandleNewThread).mockReturnValue({
    activeDraftThread: null,
    activeThread: null,
    defaultProjectRef: { environmentId: projects[0]!.environmentId, projectId: projects[0]!.id },
    handleNewThread: vi.fn().mockResolvedValue(null),
    routeDraftId: null,
    routeThreadRef: null,
  });
  await using screen = await render(
    <SidebarProvider>
      <SidebarShell collapsible="none" className="h-screen">
        <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
      </SidebarShell>
    </SidebarProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "New project folder", exact: true }));
  await userEvent.fill(page.getByRole("textbox", { name: "Folder name" }), "University");
  await userEvent.click(page.getByRole("radio", { name: "Blue", exact: true }));
  await userEvent.click(page.getByRole("checkbox", { name: "math", exact: true }));
  await userEvent.click(page.getByRole("checkbox", { name: "physics", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Save folder" }));
  const header = screen
    .getByTestId("sidebar-project-group")
    .getByRole("button", { expanded: true });
  await expect.element(header).toBeVisible();
  await vi.waitFor(() =>
    expect(screen.getByTestId("sidebar-project-folder").all()).toHaveLength(2),
  );
  await userEvent.click(header);
  await vi.waitFor(() =>
    expect(screen.getByTestId("sidebar-project-folder").all()).toHaveLength(0),
  );
  persistState(useUiStateStore.getState());
  const restored = parsePersistedState(JSON.parse(localStorage.getItem(PERSISTED_STATE_KEY)!));
  await act(() => useUiStateStore.setState(restored));
  expect(restored.sidebarProjectFolders[0]).toMatchObject({
    name: "University",
    color: "blue",
    collapsed: true,
  });
  await userEvent.click(screen.getByRole("button", { name: "Folder options for University" }));
  await userEvent.click(page.getByRole("menuitem", { name: "Edit folder", exact: true }));
  await userEvent.fill(page.getByRole("textbox", { name: "Folder name" }), "College");
  await userEvent.click(page.getByRole("radio", { name: "Green", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Save folder" }));
  expect(useUiStateStore.getState().sidebarProjectFolders[0]).toMatchObject({
    name: "College",
    color: "green",
  });
  await userEvent.click(
    screen.getByTestId("sidebar-project-group").getByRole("button", { expanded: false }),
  );
  await vi.waitFor(() =>
    expect(screen.getByTestId("sidebar-project-folder").all()).toHaveLength(2),
  );
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(
      screen.getByTestId("sidebar-project-folder").first().getByRole("button", { expanded: true }),
    )
    .toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Folder options for College" }));
  await userEvent.click(
    page.getByRole("menuitem", { name: "Delete folder (keep projects)", exact: true }),
  );
  await vi.waitFor(() => expect(screen.getByTestId("sidebar-project-group").all()).toHaveLength(0));
  expect(vi.mocked(useProjects)()).toEqual(projects);
  expect(useUiStateStore.getState().sidebarProjectFolders).toEqual([]);
});

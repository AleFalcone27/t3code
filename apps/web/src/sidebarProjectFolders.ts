import type { ProjectIconColor } from "@t3tools/contracts";
import { PROJECT_ICON_COLORS } from "./projectIconColors";

export interface SidebarProjectFolder {
  id: string;
  name: string;
  color: ProjectIconColor;
  projectKeys: string[];
  collapsed: boolean;
}

export function parseSidebarProjectFolders(value: unknown): SidebarProjectFolder[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const assigned = new Set<string>();
  return value.flatMap((entry: unknown) => {
    if (entry === null || typeof entry !== "object") return [];
    const folder = entry as Record<string, unknown>;
    if (typeof folder.id !== "string" || !folder.id || ids.has(folder.id)) return [];
    if (typeof folder.name !== "string" || !folder.name.trim()) return [];
    ids.add(folder.id);
    const projectKeys = Array.isArray(folder.projectKeys)
      ? folder.projectKeys.filter((key): key is string => {
          if (typeof key !== "string" || !key || assigned.has(key)) return false;
          assigned.add(key);
          return true;
        })
      : [];
    return [
      {
        id: folder.id,
        name: folder.name.trim(),
        color: PROJECT_ICON_COLORS.find(({ value }) => value === folder.color)?.value ?? "gray",
        projectKeys,
        collapsed: folder.collapsed === true,
      },
    ];
  });
}

export function saveSidebarProjectFolder(
  folders: readonly SidebarProjectFolder[],
  folder: SidebarProjectFolder,
): SidebarProjectFolder[] {
  const saved = parseSidebarProjectFolders([folder])[0];
  if (!saved) return [...folders];
  const keys = new Set(saved.projectKeys);
  const next = folders.map((current) =>
    current.id === saved.id
      ? saved
      : {
          ...current,
          projectKeys: current.projectKeys.filter((key) => !keys.has(key)),
        },
  );
  return folders.some((current) => current.id === saved.id) ? next : [...next, saved];
}

export function groupProjectsIntoFolders<T extends { group: { projectKey: string } }>(
  projects: readonly T[],
  folders: readonly SidebarProjectFolder[],
) {
  const assigned = new Set(folders.flatMap((folder) => folder.projectKeys));
  return [
    ...folders.map((folder) => ({
      folder,
      projects: projects.filter((project) => folder.projectKeys.includes(project.group.projectKey)),
    })),
    {
      folder: null,
      projects: projects.filter((project) => !assigned.has(project.group.projectKey)),
    },
  ];
}

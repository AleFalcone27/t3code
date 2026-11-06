import { describe, expect, it } from "vite-plus/test";
import {
  groupProjectsIntoFolders,
  parseSidebarProjectFolders,
  saveSidebarProjectFolder,
  type SidebarProjectFolder,
} from "./sidebarProjectFolders";

const university: SidebarProjectFolder = {
  id: "university",
  name: "University",
  color: "blue",
  projectKeys: ["math", "physics"],
  collapsed: false,
};

describe("sidebar project folders", () => {
  it("recovers valid folders and enforces unique memberships when loading preferences", () => {
    expect(parseSidebarProjectFolders(undefined)).toEqual([]);
    expect(
      parseSidebarProjectFolders([
        null,
        {},
        { ...university, name: " University ", projectKeys: ["math", "math", 1] },
        university,
        {
          id: "work",
          name: "Work",
          color: "invalid",
          projectKeys: ["math", "work"],
          collapsed: true,
        },
      ]),
    ).toEqual([
      { ...university, projectKeys: ["math"] },
      { id: "work", name: "Work", color: "gray", projectKeys: ["work"], collapsed: true },
    ]);
  });

  it("moves selected projects out of their previous folder while preserving other assignments", () => {
    const work: SidebarProjectFolder = {
      id: "work",
      name: "Work",
      color: "red",
      projectKeys: ["math"],
      collapsed: false,
    };
    const folders = saveSidebarProjectFolder([university], work);
    expect(folders).toEqual([{ ...university, projectKeys: ["physics"] }, work]);
    expect(
      saveSidebarProjectFolder(folders, {
        ...work,
        name: "Personal",
        color: "green",
        projectKeys: [],
      }),
    ).toEqual([
      { ...university, projectKeys: ["physics"] },
      { ...work, name: "Personal", color: "green", projectKeys: [] },
    ]);
    expect(saveSidebarProjectFolder(folders, { ...work, name: " " })).toEqual(folders);
    expect(university.projectKeys).toEqual(["math", "physics"]);
  });

  it("keeps project sort order, empty folders, and unassigned projects without duplicating rows", () => {
    const projects = ["physics", "work", "math"].map((projectKey) => ({ group: { projectKey } }));
    const empty = { ...university, id: "empty", projectKeys: ["disconnected"] };
    expect(groupProjectsIntoFolders(projects, [university, empty])).toEqual([
      { folder: university, projects: [projects[0], projects[2]] },
      { folder: empty, projects: [] },
      { folder: null, projects: [projects[1]] },
    ]);
    expect(groupProjectsIntoFolders(projects, [])).toEqual([{ folder: null, projects }]);
  });
});

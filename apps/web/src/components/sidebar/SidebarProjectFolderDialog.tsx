import { useState } from "react";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import type { SidebarProjectFolder } from "../../sidebarProjectFolders";
import { PROJECT_ICON_COLORS } from "../../projectIconColors";
import { useUiStateStore } from "../../uiStateStore";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
} from "../ui/dialog";

export function SidebarProjectFolderDialog({
  folder,
  projects,
  onClose,
}: {
  folder: SidebarProjectFolder;
  projects: readonly SidebarProjectSnapshot[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(folder);
  const save = useUiStateStore((state) => state.saveSidebarProjectFolder);
  const folders = useUiStateStore((state) => state.sidebarProjectFolders);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            save(draft);
            onClose();
          }}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader>
            <DialogTitle>
              {folders.some((entry) => entry.id === folder.id)
                ? "Edit folder"
                : "New project folder"}
            </DialogTitle>
            <DialogDescription>
              Organize projects in the boring sidebar. Removing a folder keeps its projects.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <label className="flex flex-col gap-1.5 text-sm">
              Folder name
              <Input
                name="folderName"
                autoFocus
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm">Color</legend>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Folder color">
                {PROJECT_ICON_COLORS.map((color) => (
                  <label
                    key={color.value}
                    className="relative flex size-8 cursor-pointer items-center justify-center"
                  >
                    <input
                      type="radio"
                      name="folderColor"
                      value={color.value}
                      aria-label={color.label}
                      checked={draft.color === color.value}
                      onChange={() => setDraft({ ...draft, color: color.value })}
                      className="absolute inset-0 appearance-none rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring checked:ring-2 checked:ring-inset checked:ring-ring"
                    />
                    <span
                      className={cn(
                        "pointer-events-none size-5 rounded-full",
                        color.swatchClassName,
                      )}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex min-h-0 flex-col gap-2">
              <legend className="mb-2 text-sm">Projects</legend>
              <div className="max-h-60 overflow-y-auto">
                {projects
                  .filter((project) => !project.isScratch && !project.archived)
                  .map((project) => {
                    const owner = folders.find(
                      (entry) =>
                        entry.id !== folder.id && entry.projectKeys.includes(project.projectKey),
                    );
                    return (
                      <label
                        key={project.projectKey}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-2 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          name="folderProjects"
                          value={project.projectKey}
                          checked={draft.projectKeys.includes(project.projectKey)}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              projectKeys: event.target.checked
                                ? [...draft.projectKeys, project.projectKey]
                                : draft.projectKeys.filter((key) => key !== project.projectKey),
                            })
                          }
                        />
                        <span className="min-w-0 truncate">{project.displayName}</span>
                        {owner ? (
                          <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
                            From {owner.name}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                {projects.every((project) => project.isScratch || project.archived) ? (
                  <p className="text-sm text-muted-foreground">
                    Add a project to place it in this folder.
                  </p>
                ) : null}
              </div>
            </fieldset>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!draft.name.trim()}>
              Save folder
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "vitest";
import { buildGitDiffGroups } from "../git-diff-model";
import { GitStatus } from "../git-extension-api";

describe("git diff model", () => {
  it("groups repository changes, preserves full relative paths, and filters by workspace", () => {
    const workspaceRoot = path.join(os.tmpdir(), "git-diff-workspace");
    const repositoryRoot = path.join(workspaceRoot, "repo-a");
    const externalRepositoryRoot = path.join(os.tmpdir(), "git-diff-external");

    const groups = buildGitDiffGroups(
      [
        {
          rootPath: repositoryRoot,
          mergeChanges: [
            {
              uriPath: path.join(repositoryRoot, "conflicts", "merge.md"),
              originalUriPath: path.join(repositoryRoot, "conflicts", "merge.md"),
              status: GitStatus.BOTH_MODIFIED
            }
          ],
          indexChanges: [
            {
              uriPath: path.join(repositoryRoot, "docs", "renamed-plan.md"),
              originalUriPath: path.join(repositoryRoot, "docs", "plan.md"),
              renameUriPath: path.join(repositoryRoot, "docs", "renamed-plan.md"),
              status: GitStatus.INDEX_RENAMED
            }
          ],
          workingTreeChanges: [
            {
              uriPath: path.join(repositoryRoot, "src", "extension.ts"),
              originalUriPath: path.join(repositoryRoot, "src", "extension.ts"),
              status: GitStatus.MODIFIED
            }
          ],
          untrackedChanges: [
            {
              uriPath: path.join(repositoryRoot, "src", "new-panel.ts"),
              originalUriPath: path.join(repositoryRoot, "src", "new-panel.ts"),
              status: GitStatus.UNTRACKED
            }
          ]
        },
        {
          rootPath: externalRepositoryRoot,
          mergeChanges: [],
          indexChanges: [
            {
              uriPath: path.join(externalRepositoryRoot, "ignored.txt"),
              originalUriPath: path.join(externalRepositoryRoot, "ignored.txt"),
              status: GitStatus.INDEX_MODIFIED
            }
          ],
          workingTreeChanges: [],
          untrackedChanges: []
        }
      ],
      {
        workspacePaths: [workspaceRoot]
      }
    );

    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, "repo-a");
    assert.equal(groups[0].totalCount, 4);
    assert.deepEqual(
      groups[0].visibleEntries.map((entry) => ({
        bucket: entry.bucket,
        path: entry.relativePath,
        label: entry.changeLabel,
        previousPath: entry.originalRelativePath
      })),
      [
        {
          bucket: "merge",
          path: "conflicts/merge.md",
          label: "Conflict",
          previousPath: undefined
        },
        {
          bucket: "staged",
          path: "docs/renamed-plan.md",
          label: "Renamed",
          previousPath: "docs/plan.md"
        },
        {
          bucket: "workingTree",
          path: "src/extension.ts",
          label: "Modified",
          previousPath: undefined
        },
        {
          bucket: "workingTree",
          path: "src/new-panel.ts",
          label: "Added",
          previousPath: undefined
        }
      ]
    );
  });

  it("caps large repositories at 100 visible entries by default", () => {
    const repositoryRoot = path.join(os.tmpdir(), "git-diff-overflow");

    const groups = buildGitDiffGroups([
      {
        rootPath: repositoryRoot,
        mergeChanges: [],
        indexChanges: Array.from({ length: 105 }, (_, index) => {
          const filePath = path.join(repositoryRoot, "src", `file-${index.toString().padStart(3, "0")}.ts`);
          return {
            uriPath: filePath,
            originalUriPath: filePath,
            status: GitStatus.INDEX_MODIFIED
          };
        }),
        workingTreeChanges: [],
        untrackedChanges: []
      }
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].totalCount, 105);
    assert.equal(groups[0].visibleEntries.length, 100);
    assert.equal(groups[0].hiddenCount, 5);
  });

  it("supports a custom per-repository limit", () => {
    const repositoryRoot = path.join(os.tmpdir(), "git-diff-limit");

    const groups = buildGitDiffGroups(
      [
        {
          rootPath: repositoryRoot,
          mergeChanges: [],
          indexChanges: [
            {
              uriPath: path.join(repositoryRoot, "a.ts"),
              originalUriPath: path.join(repositoryRoot, "a.ts"),
              status: GitStatus.INDEX_MODIFIED
            },
            {
              uriPath: path.join(repositoryRoot, "b.ts"),
              originalUriPath: path.join(repositoryRoot, "b.ts"),
              status: GitStatus.INDEX_MODIFIED
            }
          ],
          workingTreeChanges: [],
          untrackedChanges: []
        }
      ],
      {
        maxFilesPerRepository: 1
      }
    );

    assert.equal(groups[0].visibleEntries.length, 1);
    assert.equal(groups[0].hiddenCount, 1);
  });
});

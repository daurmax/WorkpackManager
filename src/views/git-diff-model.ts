import * as path from "node:path";
import { GitStatus } from "./git-extension-api";

export type GitDiffBucket = "merge" | "staged" | "workingTree";
export type GitDiffChangeKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "typeChanged"
  | "conflict";

export interface GitChangeSnapshot {
  readonly uriPath: string;
  readonly originalUriPath: string;
  readonly renameUriPath?: string;
  readonly status: GitStatus;
}

export interface GitRepositorySnapshot {
  readonly rootPath: string;
  readonly mergeChanges: readonly GitChangeSnapshot[];
  readonly indexChanges: readonly GitChangeSnapshot[];
  readonly workingTreeChanges: readonly GitChangeSnapshot[];
  readonly untrackedChanges: readonly GitChangeSnapshot[];
}

export interface GitDiffFileEntry {
  readonly id: string;
  readonly repositoryRootPath: string;
  readonly repositoryName: string;
  readonly bucket: GitDiffBucket;
  readonly bucketLabel: string;
  readonly kind: GitDiffChangeKind;
  readonly changeLabel: string;
  readonly relativePath: string;
  readonly originalRelativePath?: string;
  readonly uriPath: string;
  readonly originalUriPath: string;
  readonly renameUriPath?: string;
  readonly status: GitStatus;
}

export interface GitDiffRepositoryGroup {
  readonly rootPath: string;
  readonly name: string;
  readonly totalCount: number;
  readonly visibleEntries: readonly GitDiffFileEntry[];
  readonly hiddenCount: number;
}

export interface BuildGitDiffGroupsOptions {
  readonly workspacePaths?: readonly string[];
  readonly maxFilesPerRepository?: number;
}

const DEFAULT_MAX_FILES_PER_REPOSITORY = 100;

const BUCKET_ORDER: Record<GitDiffBucket, number> = {
  merge: 0,
  staged: 1,
  workingTree: 2
};

function normalizePathForComparison(targetPath: string): string {
  const normalizedPath = path.resolve(targetPath).replaceAll("\\", "/");
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
}

function normalizeRelativePath(targetPath: string): string {
  return targetPath.replaceAll("\\", "/");
}

function isWithinWorkspace(targetPath: string, workspacePaths: readonly string[]): boolean {
  if (workspacePaths.length === 0) {
    return true;
  }

  const normalizedTarget = normalizePathForComparison(targetPath);

  return workspacePaths.some((workspacePath) => {
    const normalizedWorkspace = normalizePathForComparison(workspacePath);
    return (
      normalizedTarget === normalizedWorkspace ||
      normalizedTarget.startsWith(`${normalizedWorkspace}/`)
    );
  });
}

function getRepositoryName(rootPath: string): string {
  const repositoryName = path.basename(rootPath);
  return repositoryName.length > 0 ? repositoryName : normalizeRelativePath(rootPath);
}

function getBucketLabel(bucket: GitDiffBucket): string {
  if (bucket === "merge") {
    return "Merge";
  }

  if (bucket === "staged") {
    return "Staged";
  }

  return "Working Tree";
}

function mapStatusToKind(status: GitStatus): GitDiffChangeKind {
  switch (status) {
    case GitStatus.INDEX_ADDED:
    case GitStatus.UNTRACKED:
    case GitStatus.INTENT_TO_ADD:
      return "added";
    case GitStatus.INDEX_DELETED:
    case GitStatus.DELETED:
      return "deleted";
    case GitStatus.INDEX_RENAMED:
    case GitStatus.INTENT_TO_RENAME:
      return "renamed";
    case GitStatus.INDEX_COPIED:
      return "copied";
    case GitStatus.TYPE_CHANGED:
      return "typeChanged";
    case GitStatus.ADDED_BY_US:
    case GitStatus.ADDED_BY_THEM:
    case GitStatus.DELETED_BY_US:
    case GitStatus.DELETED_BY_THEM:
    case GitStatus.BOTH_ADDED:
    case GitStatus.BOTH_DELETED:
    case GitStatus.BOTH_MODIFIED:
      return "conflict";
    default:
      return "modified";
  }
}

function getChangeLabel(kind: GitDiffChangeKind): string {
  if (kind === "added") {
    return "Added";
  }

  if (kind === "deleted") {
    return "Deleted";
  }

  if (kind === "renamed") {
    return "Renamed";
  }

  if (kind === "copied") {
    return "Copied";
  }

  if (kind === "typeChanged") {
    return "Type Changed";
  }

  if (kind === "conflict") {
    return "Conflict";
  }

  return "Modified";
}

function compareEntries(left: GitDiffFileEntry, right: GitDiffFileEntry): number {
  const bucketCompare = BUCKET_ORDER[left.bucket] - BUCKET_ORDER[right.bucket];
  if (bucketCompare !== 0) {
    return bucketCompare;
  }

  const pathCompare = left.relativePath.localeCompare(right.relativePath);
  if (pathCompare !== 0) {
    return pathCompare;
  }

  return left.changeLabel.localeCompare(right.changeLabel);
}

function compareGroups(left: GitDiffRepositoryGroup, right: GitDiffRepositoryGroup): number {
  return left.name.localeCompare(right.name) || left.rootPath.localeCompare(right.rootPath);
}

function toRelativePath(repositoryRootPath: string, targetPath: string): string {
  const relativePath = path.relative(repositoryRootPath, targetPath);
  return normalizeRelativePath(relativePath.length > 0 ? relativePath : path.basename(targetPath));
}

function toEntries(
  repository: GitRepositorySnapshot,
  bucket: GitDiffBucket,
  changes: readonly GitChangeSnapshot[]
): GitDiffFileEntry[] {
  const repositoryName = getRepositoryName(repository.rootPath);
  const bucketLabel = getBucketLabel(bucket);

  return changes.map((change) => {
    const kind = mapStatusToKind(change.status);
    const relativePath = toRelativePath(repository.rootPath, change.uriPath);
    const originalRelativePath =
      change.originalUriPath !== change.uriPath
        ? toRelativePath(repository.rootPath, change.originalUriPath)
        : undefined;

    return {
      id: [
        normalizePathForComparison(repository.rootPath),
        bucket,
        normalizePathForComparison(change.uriPath),
        change.status
      ].join(":"),
      repositoryRootPath: repository.rootPath,
      repositoryName,
      bucket,
      bucketLabel,
      kind,
      changeLabel: getChangeLabel(kind),
      relativePath,
      originalRelativePath,
      uriPath: change.uriPath,
      originalUriPath: change.originalUriPath,
      renameUriPath: change.renameUriPath,
      status: change.status
    };
  });
}

export function buildGitDiffGroups(
  repositories: readonly GitRepositorySnapshot[],
  options: BuildGitDiffGroupsOptions = {}
): GitDiffRepositoryGroup[] {
  const workspacePaths = [...(options.workspacePaths ?? [])];
  const maxFilesPerRepository = options.maxFilesPerRepository ?? DEFAULT_MAX_FILES_PER_REPOSITORY;

  const visibleRepositories = repositories.filter((repository) =>
    isWithinWorkspace(repository.rootPath, workspacePaths)
  );

  return visibleRepositories
    .map((repository) => {
      const entries = [
        ...toEntries(repository, "merge", repository.mergeChanges),
        ...toEntries(repository, "staged", repository.indexChanges),
        ...toEntries(repository, "workingTree", repository.workingTreeChanges),
        ...toEntries(repository, "workingTree", repository.untrackedChanges)
      ].sort(compareEntries);

      const visibleEntries = entries.slice(0, maxFilesPerRepository);

      return {
        rootPath: repository.rootPath,
        name: getRepositoryName(repository.rootPath),
        totalCount: entries.length,
        visibleEntries,
        hiddenCount: Math.max(entries.length - visibleEntries.length, 0)
      };
    })
    .filter((group) => group.totalCount > 0)
    .sort(compareGroups);
}

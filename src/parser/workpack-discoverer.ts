import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { DiscoverySource, WorkpackInstance } from "../models";
import { parseWorkpackInstance } from "./workpack-parser";

const WORKPACK_INSTANCES_RELATIVE_PATH = path.join("workpacks", "instances");
const GROUP_META_FILE = "group.meta.json";
const REQUEST_FILE = "00_request.md";
const PLAN_FILE = "01_plan.md";
const META_FILE = "workpack.meta.json";

const STANDALONE_WORKPACK_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const GROUPED_WORKPACK_PATTERN =
  /^[0-9]{2}_[a-z0-9](?:[a-z0-9-]*[a-z0-9])?_[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

const manualFolders = new Map<string, string>();

function warn(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.warn(`[workpack-discoverer] ${message}: ${error.message}`);
    return;
  }

  console.warn(`[workpack-discoverer] ${message}`);
}

function toAbsolutePath(inputPath: string): string {
  return path.resolve(inputPath);
}

function toPathKey(inputPath: string): string {
  const resolved = toAbsolutePath(inputPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(inputPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(inputPath: string): Promise<boolean> {
  try {
    await fs.access(inputPath);
    return true;
  } catch {
    return false;
  }
}

async function looksLikeWorkpackFolder(folderPath: string): Promise<boolean> {
  const [hasMeta, hasRequest, hasPlan] = await Promise.all([
    fileExists(path.join(folderPath, META_FILE)),
    fileExists(path.join(folderPath, REQUEST_FILE)),
    fileExists(path.join(folderPath, PLAN_FILE))
  ]);

  return hasMeta || (hasRequest && hasPlan);
}

async function isGroupFolder(folderPath: string): Promise<boolean> {
  return fileExists(path.join(folderPath, GROUP_META_FILE));
}

async function discoverFromGroup(groupFolderPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(groupFolderPath, { withFileTypes: true });
    const discovered: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateFolder = path.join(groupFolderPath, entry.name);
      if (!isWorkpackFolder(candidateFolder)) {
        continue;
      }

      if (await looksLikeWorkpackFolder(candidateFolder)) {
        discovered.push(candidateFolder);
      }
    }

    return discovered;
  } catch (error) {
    warn(`Unable to read group folder ${groupFolderPath}`, error);
    return [];
  }
}

async function discoverFromInstancesDirectory(instancesFolderPath: string): Promise<string[]> {
  if (!(await isDirectory(instancesFolderPath))) {
    return [];
  }

  try {
    const entries = await fs.readdir(instancesFolderPath, { withFileTypes: true });
    const discovered: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateFolder = path.join(instancesFolderPath, entry.name);
      if (await isGroupFolder(candidateFolder)) {
        discovered.push(...(await discoverFromGroup(candidateFolder)));
        continue;
      }

      if (!isWorkpackFolder(candidateFolder)) {
        continue;
      }

      if (await looksLikeWorkpackFolder(candidateFolder)) {
        discovered.push(candidateFolder);
      }
    }

    return discovered;
  } catch (error) {
    warn(`Unable to scan ${instancesFolderPath}`, error);
    return [];
  }
}

async function discoverManualFolder(folderPath: string): Promise<string[]> {
  const resolvedFolder = toAbsolutePath(folderPath);
  if (!(await isDirectory(resolvedFolder))) {
    warn(`Manual folder does not exist or is not a directory: ${resolvedFolder}`);
    return [];
  }

  if (await isGroupFolder(resolvedFolder)) {
    return discoverFromGroup(resolvedFolder);
  }

  if (await looksLikeWorkpackFolder(resolvedFolder)) {
    return [resolvedFolder];
  }

  return discoverFromInstancesDirectory(resolvedFolder);
}

function registerCandidate(
  target: Map<string, { folderPath: string; source: DiscoverySource; sourceProject: string }>,
  folderPath: string,
  source: DiscoverySource,
  sourceProject: string
): void {
  const resolvedFolder = toAbsolutePath(folderPath);
  const key = toPathKey(resolvedFolder);

  const existing = target.get(key);
  if (!existing) {
    target.set(key, { folderPath: resolvedFolder, source, sourceProject });
    return;
  }

  if (source === "manual") {
    target.set(key, { folderPath: resolvedFolder, source, sourceProject });
  }
}

export function isWorkpackFolder(inputPath: string): boolean {
  const folderName = path.basename(inputPath.trim());
  if (!folderName) {
    return false;
  }

  return STANDALONE_WORKPACK_PATTERN.test(folderName) || GROUPED_WORKPACK_PATTERN.test(folderName);
}

export function registerManualWorkpackFolder(folderPath: string): void {
  const resolved = toAbsolutePath(folderPath);
  manualFolders.set(toPathKey(resolved), resolved);
}

export function unregisterManualWorkpackFolder(folderPath: string): void {
  manualFolders.delete(toPathKey(folderPath));
}

export function clearManualWorkpackFolders(): void {
  manualFolders.clear();
}

export function getManualWorkpackFolders(): string[] {
  return Array.from(manualFolders.values());
}

export async function discoverWorkpacks(workspaceFolders: string[]): Promise<WorkpackInstance[]> {
  const candidates = new Map<string, { folderPath: string; source: DiscoverySource; sourceProject: string }>();

  for (const workspaceFolder of workspaceFolders) {
    const resolvedWorkspace = toAbsolutePath(workspaceFolder);
    const projectName = path.basename(resolvedWorkspace);

    // Direct: <workspace>/workpacks/instances/
    const instancesPath = path.join(resolvedWorkspace, WORKPACK_INSTANCES_RELATIVE_PATH);
    const discovered = await discoverFromInstancesDirectory(instancesPath);
    for (const folderPath of discovered) {
      registerCandidate(candidates, folderPath, "auto", projectName);
    }

    // One level deeper: <workspace>/<child-repo>/workpacks/instances/
    // Supports multi-repo layouts where each subdirectory is a separate project.
    if (discovered.length === 0) {
      try {
        const children = await fs.readdir(resolvedWorkspace, { withFileTypes: true });
        for (const child of children) {
          if (!child.isDirectory() || child.name.startsWith(".") || child.name === "node_modules") {
            continue;
          }
          const childInstancesPath = path.join(resolvedWorkspace, child.name, WORKPACK_INSTANCES_RELATIVE_PATH);
          const childDiscovered = await discoverFromInstancesDirectory(childInstancesPath);
          for (const folderPath of childDiscovered) {
            registerCandidate(candidates, folderPath, "auto", child.name);
          }
        }
      } catch {
        // Workspace folder not readable — skip child scan
      }
    }
  }

  for (const manualFolder of manualFolders.values()) {
    const discovered = await discoverManualFolder(manualFolder);
    for (const folderPath of discovered) {
      // Derive project name from the workpack path: …/<project>/workpacks/instances/…
      const instancesIdx = folderPath.replace(/\\/g, "/").indexOf("/workpacks/instances/");
      const projectRoot = instancesIdx !== -1 ? folderPath.substring(0, instancesIdx) : folderPath;
      registerCandidate(candidates, folderPath, "manual", path.basename(projectRoot));
    }
  }

  const parsedInstances = await Promise.all(
    Array.from(candidates.values()).map(async ({ folderPath, source, sourceProject }) => {
      try {
        const instance = await parseWorkpackInstance(folderPath);
        return {
          ...instance,
          discoverySource: source,
          sourceProject
        } satisfies WorkpackInstance;
      } catch (error) {
        warn(`Skipping unparseable workpack at ${folderPath}`, error);
        return null;
      }
    })
  );

  return parsedInstances
    .filter((instance): instance is WorkpackInstance => instance !== null)
    .sort((left, right) => left.meta.id.localeCompare(right.meta.id));
}

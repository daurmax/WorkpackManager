import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFilePath);
const workspaceRoot = path.resolve(scriptsDirectory, "..");
const packageJsonPath = path.join(workspaceRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

if (typeof version !== "string" || version.trim().length === 0) {
  throw new Error("Unable to determine extension version from package.json.");
}

execSync("npm run package:vsix", {
  cwd: workspaceRoot,
  stdio: "inherit",
});

const vsixPath = path.join(workspaceRoot, `workpack-manager-${version}.vsix`);

execSync(`code --install-extension "${vsixPath}" --force`, {
  cwd: workspaceRoot,
  stdio: "inherit",
});

console.log(`Installed ${path.basename(vsixPath)}.`);

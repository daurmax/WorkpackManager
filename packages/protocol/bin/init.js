#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_DIR = "workpacks";

function printUsage() {
  console.log(`Usage:
  npx @workpack/protocol init [options]
  workpack-init [init] [options]

Options:
  --dir <path>                Target directory (default: workpacks/)
  --protocol-version <value>  Protocol version stamped in workpack.config.json
  --help                      Show this help message
`);
}

function readRequiredValue(args, index, flagName) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function parseArgs(args) {
  const options = {
    dir: DEFAULT_DIR,
    protocolVersion: null,
    help: false,
  };
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dir") {
      options.dir = readRequiredValue(args, i, "--dir");
      i += 1;
      continue;
    }

    if (arg.startsWith("--dir=")) {
      const value = arg.slice("--dir=".length);
      if (!value) {
        throw new Error("Missing value for --dir");
      }
      options.dir = value;
      continue;
    }

    if (arg === "--protocol-version") {
      options.protocolVersion = readRequiredValue(args, i, "--protocol-version");
      i += 1;
      continue;
    }

    if (arg.startsWith("--protocol-version=")) {
      const value = arg.slice("--protocol-version=".length);
      if (!value) {
        throw new Error("Missing value for --protocol-version");
      }
      options.protocolVersion = value;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length > 0) {
    if (positionals[0] !== "init") {
      throw new Error(`Unknown command: ${positionals[0]}`);
    }
    if (positionals.length > 1) {
      throw new Error(`Unexpected argument: ${positionals[1]}`);
    }
  }

  return options;
}

function collectFilesRecursive(rootDir) {
  const files = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursive(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function copySchemas(sourceDir, targetDir, writtenFiles) {
  const entries = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"));

  if (entries.length === 0) {
    throw new Error(`No schema files found in ${sourceDir}`);
  }

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    fs.copyFileSync(sourcePath, targetPath);
    writtenFiles.push(targetPath);
  }
}

function copyDirectory(sourceDir, targetDir, writtenFiles) {
  const sourceFiles = collectFilesRecursive(sourceDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

  for (const sourceFile of sourceFiles) {
    const relativePath = path.relative(sourceDir, sourceFile);
    writtenFiles.push(path.join(targetDir, relativePath));
  }
}

function writeConfig(targetDir, protocolVersion, writtenFiles) {
  const configPath = path.join(targetDir, "workpack.config.json");
  const config = {
    protocol_version: protocolVersion,
    instance_dir: "instances",
    schemas: {
      meta: "WORKPACK_META_SCHEMA.json",
      state: "WORKPACK_STATE_SCHEMA.json",
    },
  };

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  writtenFiles.push(configPath);
}

function readPackageVersion(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new Error(`Invalid or missing version in ${packageJsonPath}`);
  }
  return packageJson.version;
}

function ensureDirectoryExists(directoryPath, label) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`Missing ${label} directory: ${directoryPath}`);
  }
}

function printSummary(targetDir, writtenFiles) {
  const relativeFiles = writtenFiles
    .map((filePath) => path.relative(process.cwd(), filePath))
    .sort((left, right) => left.localeCompare(right));

  console.log(`Initialized workpack infrastructure in: ${targetDir}`);
  console.log("Created or updated files:");
  for (const filePath of relativeFiles) {
    console.log(` - ${filePath}`);
  }
  console.log(`Total files: ${relativeFiles.length}`);
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return 0;
  }

  const scriptPath = fs.realpathSync(process.argv[1]);
  const packageRoot = path.resolve(path.dirname(scriptPath), "..");

  const schemasSourceDir = path.join(packageRoot, "schemas");
  const templatesSourceDir = path.join(packageRoot, "templates");
  const toolsSourceDir = path.join(packageRoot, "tools");

  ensureDirectoryExists(schemasSourceDir, "schemas");
  ensureDirectoryExists(templatesSourceDir, "templates");
  ensureDirectoryExists(toolsSourceDir, "tools");

  const protocolVersion = args.protocolVersion || readPackageVersion(packageRoot);
  const targetDir = path.resolve(process.cwd(), args.dir);

  fs.mkdirSync(targetDir, { recursive: true });

  const writtenFiles = [];
  copySchemas(schemasSourceDir, targetDir, writtenFiles);
  copyDirectory(templatesSourceDir, path.join(targetDir, "_template"), writtenFiles);
  copyDirectory(toolsSourceDir, path.join(targetDir, "tools"), writtenFiles);
  writeConfig(targetDir, protocolVersion, writtenFiles);
  printSummary(targetDir, writtenFiles);

  return 0;
}

try {
  const exitCode = run();
  process.exit(exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  console.error("Run with --help for usage.");
  process.exit(1);
}

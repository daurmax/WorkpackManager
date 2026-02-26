#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testFilePath = fs.realpathSync(process.argv[1]);
const testsDir = path.dirname(testFilePath);
const protocolDir = path.resolve(testsDir, "..");
const initScriptPath = path.join(protocolDir, "bin", "init.js");
const packageJsonPath = path.join(protocolDir, "package.json");
const schemasSourceDir = path.join(protocolDir, "schemas");
const templatesSourceDir = path.join(protocolDir, "templates");
const toolsSourceDir = path.join(protocolDir, "tools");

function listFilesRecursive(rootDir, currentDir = rootDir) {
  const files = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(rootDir, absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(path.relative(rootDir, absolutePath));
    }
  }

  return files;
}

function runInit(cwd, args) {
  const result = spawnSync(process.execPath, [initScriptPath, ...args], {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Init command failed with status ${result.status}.`,
        `stdout:\n${result.stdout}`,
        `stderr:\n${result.stderr}`,
      ].join("\n"),
    );
  }

  return result;
}

function assertFilesExist(rootDir, relativeFiles, label) {
  for (const relativeFile of relativeFiles) {
    const destination = path.join(rootDir, relativeFile);
    assert.ok(fs.existsSync(destination), `${label} missing: ${destination}`);
  }
}

function readConfig(configDir) {
  const configPath = path.join(configDir, "workpack.config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function run() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const expectedVersion = packageJson.version;
  const schemaFiles = listFilesRecursive(schemasSourceDir).filter((filePath) =>
    filePath.toLowerCase().endsWith(".json"),
  );
  const templateFiles = listFilesRecursive(templatesSourceDir);
  const toolFiles = listFilesRecursive(toolsSourceDir);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workpack-init-test-"));

  try {
    const defaultProjectDir = path.join(tempRoot, "default-project");
    fs.mkdirSync(defaultProjectDir, { recursive: true });
    runInit(defaultProjectDir, ["init"]);

    const defaultOutputDir = path.join(defaultProjectDir, "workpacks");
    assert.ok(fs.existsSync(defaultOutputDir), "workpacks directory was not created");
    assertFilesExist(defaultOutputDir, schemaFiles, "schema file");
    assertFilesExist(path.join(defaultOutputDir, "_template"), templateFiles, "template file");
    assertFilesExist(path.join(defaultOutputDir, "tools"), toolFiles, "tool file");

    const defaultConfig = readConfig(defaultOutputDir);
    assert.deepEqual(defaultConfig, {
      protocol_version: expectedVersion,
      instance_dir: "instances",
      schemas: {
        meta: "WORKPACK_META_SCHEMA.json",
        state: "WORKPACK_STATE_SCHEMA.json",
      },
    });

    const customProjectDir = path.join(tempRoot, "custom-project");
    fs.mkdirSync(customProjectDir, { recursive: true });
    runInit(customProjectDir, ["init", "--dir", "custom-wp", "--protocol-version", "3.0.0"]);

    const customOutputDir = path.join(customProjectDir, "custom-wp");
    assert.ok(fs.existsSync(customOutputDir), "custom output directory was not created");
    assertFilesExist(customOutputDir, schemaFiles, "custom schema file");

    const customConfig = readConfig(customOutputDir);
    assert.equal(customConfig.protocol_version, "3.0.0");
    assert.equal(customConfig.instance_dir, "instances");
    assert.deepEqual(customConfig.schemas, {
      meta: "WORKPACK_META_SCHEMA.json",
      state: "WORKPACK_STATE_SCHEMA.json",
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log("test-init: PASS");
}

try {
  run();
} catch (error) {
  console.error("test-init: FAIL");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
}

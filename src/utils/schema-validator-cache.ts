import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface SchemaValidatorCacheOptions {
  workpacksDirectoryName?: string;
  onWarning?: (message: string, error?: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SchemaValidatorCache {
  private readonly ajv: Ajv2020;
  private readonly workpacksDirectoryName: string;
  private readonly onWarning?: (message: string, error?: unknown) => void;
  private readonly validatorCache = new Map<string, ValidateFunction<unknown>>();
  private readonly validatorPromiseCache = new Map<string, Promise<ValidateFunction<unknown> | null>>();

  public constructor(options?: SchemaValidatorCacheOptions) {
    this.ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.workpacksDirectoryName = options?.workpacksDirectoryName ?? "workpacks";
    this.onWarning = options?.onWarning;
  }

  public async getValidator(
    folderPath: string,
    schemaFileName: string
  ): Promise<ValidateFunction<unknown> | null> {
    const schemaPath = await this.resolveSchemaPath(folderPath, schemaFileName);
    if (!schemaPath) {
      this.warn(`Unable to locate ${schemaFileName} while parsing ${folderPath}`);
      return null;
    }

    const cachedValidator = this.validatorCache.get(schemaPath);
    if (cachedValidator) {
      return cachedValidator;
    }

    const inFlightValidator = this.validatorPromiseCache.get(schemaPath);
    if (inFlightValidator) {
      return inFlightValidator;
    }

    const loadValidatorPromise = this.loadValidator(schemaPath);
    this.validatorPromiseCache.set(schemaPath, loadValidatorPromise);

    try {
      return await loadValidatorPromise;
    } finally {
      this.validatorPromiseCache.delete(schemaPath);
    }
  }

  private async loadValidator(schemaPath: string): Promise<ValidateFunction<unknown> | null> {
    const schema = await this.readSchema(schemaPath);
    if (!schema) {
      return null;
    }

    try {
      const validator = this.ajv.compile(schema);
      this.validatorCache.set(schemaPath, validator);
      return validator;
    } catch (error) {
      const existingBySchemaId =
        isRecord(schema) && typeof schema.$id === "string" ? this.ajv.getSchema(schema.$id) : null;

      if (existingBySchemaId) {
        this.validatorCache.set(schemaPath, existingBySchemaId);
        return existingBySchemaId;
      }

      this.warn(`Unable to compile schema ${schemaPath}`, error);
      return null;
    }
  }

  private async resolveSchemaPath(folderPath: string, schemaFileName: string): Promise<string | null> {
    let currentPath = path.resolve(folderPath);

    while (true) {
      const candidatePath = path.join(currentPath, this.workpacksDirectoryName, schemaFileName);
      if (await this.pathExists(candidatePath)) {
        return candidatePath;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return null;
      }

      currentPath = parentPath;
    }
  }

  private async readSchema(schemaPath: string): Promise<AnySchema | null> {
    let rawSchema: string;
    try {
      rawSchema = await fs.readFile(schemaPath, "utf8");
    } catch (error) {
      this.warn(`Unable to read schema file ${schemaPath}`, error);
      return null;
    }

    try {
      return JSON.parse(rawSchema) as AnySchema;
    } catch (error) {
      this.warn(`Malformed schema JSON in ${schemaPath}`, error);
      return null;
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private warn(message: string, error?: unknown): void {
    if (this.onWarning) {
      this.onWarning(message, error);
    }
  }
}

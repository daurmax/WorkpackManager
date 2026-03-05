import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/__mocks__/vscode.ts")
    }
  },
  test: {
    include: [
      "src/models/__tests__/types.test.ts",
      "src/parser/__tests__/parser.test.ts",
      "src/state/__tests__/state.test.ts",
      "src/agents/__tests__/registry.test.ts",
      "src/agents/__tests__/copilot-provider.test.ts",
      "src/__tests__/extension.integration.test.ts",
      "src/views/__tests__/tree-provider.test.ts",
      "src/views/__tests__/status-icons.test.ts",
      "src/views/__tests__/workpack-tree-item.test.ts",
      "src/commands/__tests__/commands.test.ts",
      "src/__mocks__/__tests__/vscode-mock.test.ts"
    ],
    exclude: ["**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: [
        "src/__mocks__/vscode.ts",
        "src/agents/registry.ts",
        "src/parser/workpack-parser.ts",
        "src/state/output-scanner.ts",
        "src/state/reconciliation-engine.ts",
        "src/state/status-markdown-parser.ts",
        "src/views/status-icons.ts",
        "src/views/workpack-tree-item.ts"
      ],
      exclude: ["src/**/__tests__/**", "src/**/*.d.ts", "src/test/**"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },
    environment: "node"
  }
});

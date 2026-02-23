---
prompt_id: A1_test_strategy
workpack: 04_workpack-manager_validation-quality
agent_role: Test framework architect
depends_on:
  - A0_bootstrap
repos:
  - WorkpackManager
estimated_effort: M
---

# A1 – Test Framework and Coverage Configuration

## Objective

Configure the test framework (Vitest recommended, Mocha as fallback), set up coverage reporting, and create the initial test suite structure with tests for all existing modules.

## Deliverables

### 1. Test Framework Configuration

#### Vitest (preferred)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    environment: 'node',
  },
});
```

#### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 2. Extension Host Tests

For tests requiring `vscode` API:

```typescript
// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  mocha: {
    timeout: 20000,
  },
});
```

### 3. Mock Setup

Create `src/__mocks__/vscode.ts`:
- Mock `vscode.workspace`, `vscode.window`, `vscode.Uri`.
- Mock `vscode.DiagnosticCollection`, `vscode.FileSystemWatcher`.
- Mock `vscode.lm.selectChatModels` for agent tests.

### 4. Initial Test Suite

Write tests for existing modules (from WP01, WP02, WP03):

| Module | Test File | Minimum Tests |
|--------|-----------|---------------|
| Models | `src/models/__tests__/types.test.ts` | Type guard tests |
| Parser | `src/parser/__tests__/parser.test.ts` | Parse fixtures, error cases |
| State | `src/state/__tests__/state.test.ts` | Reconciliation logic |
| Registry | `src/agents/__tests__/registry.test.ts` | Already exists, verify |
| Tree Provider | `src/views/__tests__/tree-provider.test.ts` | Already exists, verify |

### 5. Test Fixtures

Create `src/__fixtures__/` with sample workpack data:
- A valid v6 workpack directory.
- An invalid workpack (missing files).
- A v5 workpack (for migration tests).

## Constraints

- Unit tests must not require VS Code extension host (use mocks).
- Integration tests can use `@vscode/test-electron` but are not required for this prompt.
- Coverage thresholds start at 60% and can be increased.

## Output

Write `outputs/A1_test_strategy.json`.

## Gate

- [ ] `npm test` runs successfully.
- [ ] Coverage report is generated.
- [ ] All existing tests pass.
- [ ] vscode mock is functional.

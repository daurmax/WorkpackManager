---
prompt_id: A5_ci_pipeline
workpack: 2026-02-23_feature_extension-validation-quality
agent_role: CI/CD pipeline engineer
depends_on:
  - A1_test_strategy
  - A2_protocol_linter
  - A3_drift_detection
  - A4_migration_compat
repos:
  - WorkpackManager
estimated_effort: S
---

# A5 – GitHub Actions CI Pipeline

## Objective

Create a GitHub Actions workflow that runs type checking, linting, tests, and coverage on every PR and push to `main`.

## Deliverables

### 1. CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
        name: Type Check
      - run: npm run lint
        name: Lint
      - run: npm test
        name: Unit Tests
      - run: npm run test:coverage
        name: Coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-${{ matrix.node-version }}
          path: coverage/
```

### 2. Lint Script

Add to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix"
  }
}
```

### 3. ESLint Configuration

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": "warn"
  }
}
```

### 4. Branch Protection Rules (documented)

Document recommended branch protection settings:
- Require status checks to pass before merge.
- Required checks: `check (18)`, `check (20)`.
- Require PR reviews.

## Constraints

- CI must complete in < 5 minutes.
- No secrets required for CI (tests use mocks).
- Coverage artifacts are uploaded for inspection.

## Output

Write `outputs/A5_ci_pipeline.json`.

## Gate

- [ ] Workflow file is valid YAML.
- [ ] CI runs successfully on a test push.
- [ ] Type check, lint, and tests all pass in CI.

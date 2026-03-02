# Recommended Branch Protection (`main`)

Configure repository branch protection for `main` with the following minimum rules:

- Require a pull request before merging.
- Require approvals (at least 1 review).
- Require status checks to pass before merging.
- Required checks:
  - `check (18)`
  - `check (20)`

Notes:

- The checks above come from `.github/workflows/ci.yml` matrix job `check` with Node versions `18` and `20`.
- CI does not require secrets and uses mocked tests.

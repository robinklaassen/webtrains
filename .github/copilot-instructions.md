---
name: webtrains-workflow
description: "Apply to all work in this project. Preferences: use npm scripts for linting, formatting, and type checks, after making changes to source files."
---

# Webtrains Development Workflow

## Linting & Formatting

After making changes to source files, run `npm run check` to:
- Run linting and formatting checks
- Ensure code quality before committing

If there are any issues found, you may run `npm run fix` to automatically fix linting and formatting issues.
If this automatic fixing does not resolve all issues, please review the output from the command and manually fix any remaining issues.

This should be done as part of the development workflow on every change to verify code style and catch potential issues early.

## Type checks
After making changes to TypeScript files, run `npm run tsc` to ensure there are no type errors in the codebase. This is important to maintain type safety and catch any potential issues that could arise from type mismatches.
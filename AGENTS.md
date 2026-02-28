<!--
This file is designed to guide AI agents in their contributions to the project.
For more information, please visit https://agents.md
-->

# AGENTS.md

This document provides instructions for AI agents to contribute to the Seerr project.

## Project Overview

Seerr is a self-hosted, user-friendly application for managing media requests and discovering new content. It integrates with other services like Radarr and Sonarr.

The project is a Next.js application written in TypeScript. It uses TypeORM for the backend database (supporting both SQLite and PostgreSQL) and Tailwind CSS for styling.

## Getting Started

To set up a development environment, follow these steps:

1.  **Prerequisites:**
    *   Node.js and pnpm. Required versions are specified in the `engines` field in `package.json`.
    *   Git

2.  **Installation:**
    ```bash
    git clone https://github.com/seerr-team/seerr.git
    cd seerr
    pnpm install
    ```

3.  **Running the development server:**
    ```bash
    pnpm dev
    ```
    The application will be available at http://localhost:3000.

Alternatively, you can use Docker:
```bash
docker compose up -d
```

## Build and Test

### Build

To create a production build, run:

```bash
pnpm build
```

### Testing

While there are no specific unit test commands mentioned, the project uses Cypress for end-to-end testing. Ensure all checks pass when you submit a pull request.

The CI workflow runs linting, formatting checks, and Cypress tests. To run checks locally, you can use the following:

*   **Linting:** `pnpm lint`
*   **Formatting Check:** The project uses Prettier. You can run `pnpm format:check` to verify formatting.
*   **Fix Formatting:** To automatically fix formatting issues, run `pnpm format`.

### Database Migrations

If your changes require a database schema modification, you need to generate migration files for both SQLite and PostgreSQL.

1.  Generate SQLite migration:
    ```bash
    pnpm migration:generate server/migration/sqlite/YourMigrationName
    ```
2.  Generate PostgreSQL migration:
    ```bash
    DB_TYPE="postgres" DB_USER=postgres DB_PASS=postgres pnpm migration:generate server/migration/postgres/YourMigrationName
    ```

## Code Style

-   **Formatting:** Code is formatted using Prettier. Ensure your code is formatted before committing by running `pnpm format`.
-   **UI Text:** Follow the UI text style guidelines in `CONTRIBUTING.md`. Be concise, use proper capitalization (Title Case for headings, buttons, etc.), and use correct punctuation.

## Translations

Contributions to translations are welcome! The project uses [Weblate](https://translate.seerr.dev/projects/seerr/seerr-frontend/) for localization. You can help translate Seerr into your language there. Please do not modify translation files directly in this repository; all translation changes should be made through Weblate.

## Pull Requests

-   Open pull requests against the `develop` branch.
-   PR titles must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
-   Rebase your branch on the latest `develop` before submitting.
-   Respect the pull request template.

### AI Assistance Disclosure

**IMPORTANT:** If you are using any AI assistance, you **must** disclose it in the pull request description. This includes code generation, documentation, or even help with understanding the codebase. Failure to do so will result in the PR being rejected.

Example disclosure:

> This PR was written with the assistance of an AI. I have reviewed and verified all changes.

## Security

Please report any security vulnerabilities by following the instructions in `SECURITY.md`. **Do not** report security issues in public GitHub issues.

## Documentation

The project has two main documentation locations:

1.  `docs/`: Contains user-facing documentation in Markdown (`.mdx`).
2.  `gen-docs/`: A Docusaurus project for generating the official documentation website.

When making changes that affect users, please update the relevant documentation.

To work on the documentation site, you need to install its specific dependencies. You can do this by running the following command from the project root:
```bash
pnpm install --filter gen-docs
```

To test the documentation site locally, run the following command from the root of the project to start the local development server:
```bash
pnpm --filter gen-docs start
```
This will start a local development server for the Docusaurus site.

## Code of Conduct

All contributors are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful and constructive.

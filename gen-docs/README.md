# Seerr Documentation

Seerr docs is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

Seerr docs will be available at [docs.seerr.dev](https://docs.seerr.dev).

### Installation

```bash
pnpm install
```

### Local Development

```bash
pnpm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
pnpm build
```

This command generates static content in the `build` directory, which can then be served using any static content hosting service.

### Test API Rest documentation

This command generates REST API documentation.

```bash
pnpm gen-api-docs all
```

This command cleans REST API documentation.

```bash
pnpm clean-api-docs all
```

See [docusaurus-openapi-docs](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs/tree/main#cli-usage) for more information.


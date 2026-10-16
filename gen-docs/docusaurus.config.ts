import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Seerr',
  tagline: 'One Stop Solution for all your media request needs',
  favicon: 'img/favicon.ico',

  url: 'https://docs.seerr.dev',
  baseUrl: '/',
  trailingSlash: true,

  future: {
    faster: {
      swcJsMinimizer: true,
    },
  },

  organizationName: 'seerr-team',
  projectName: 'seerr',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          path: '../docs',
          editUrl: 'https://github.com/seerr-team/seerr/edit/develop/docs/',
          docItemComponent: '@theme/ApiItem',
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            const items = await defaultSidebarItemsGenerator(args);
            return items.filter(
              (item) =>
                !(
                  item.type === 'category' &&
                  item.label?.toLowerCase() === 'api'
                )
            );
          },
        },
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          seerr: {
            specPath: '../seerr-api.yml',
            outputDir: '../docs/api',
            sidebarOptions: {
              groupPathsBy: 'tag',
            },
            downloadUrl:
              'https://raw.githubusercontent.com/seerr-team/seerr/refs/heads/develop/seerr-api.yml',
            hideSendButton: true,
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      /**  @type {import("@easyops-cn/docusaurus-search-local").PluginOptions}  */
      {
        hashed: true,
        indexBlog: false,
        docsDir: '../docs',
        docsRouteBasePath: '/',
        explicitSearchResultPath: true,
      },
    ],
    'docusaurus-theme-openapi-docs',
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      logo: {
        alt: 'Seerr',
        src: 'img/logo_full.svg',
      },
      items: [
        {
          to: '/api/seerr-api',
          label: 'REST API',
          position: 'right',
        },
        {
          to: 'blog',
          label: 'Blog',
          position: 'right',
        },
        {
          href: 'https://discord.gg/seerr',
          label: 'Discord',
          position: 'right',
        },
        {
          href: 'https://github.com/seerr-team/seerr',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Documentation',
              to: '/',
            },
            {
              label: 'REST API',
              to: '/api/seerr-api',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/seerr-team/seerr',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/seerr',
            },
            {
              label: 'Github Discussions',
              href: 'https://github.com/seerr-team/seerr/discussions',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Seerr. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.shadesOfPurple,
      darkTheme: prismThemes.shadesOfPurple,
      additionalLanguages: [
        'bash',
        'powershell',
        'yaml',
        'nix',
        'nginx',
        'batch',
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

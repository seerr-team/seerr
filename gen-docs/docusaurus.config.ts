import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Seerr',
  tagline: 'One Stop Solution for all your media request needs',
  favicon: 'img/favicon.ico',

  url: 'https://docs.seerr.dev',
  baseUrl: '/',
  trailingSlash: false,

  organizationName: 'seerr-team',
  projectName: 'seerr',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

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
        },
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
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
        src: 'img/logo.svg',
      },
      items: [
        {
          to: 'blog',
          label: 'Blog',
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
      additionalLanguages: ['bash', 'powershell', 'yaml', 'nix', 'nginx'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

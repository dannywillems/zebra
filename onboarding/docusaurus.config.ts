import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// The fork URL the deploy targets.
const FORK_OWNER = "dannywillems";
const FORK_REPO = "zebra";
// The upstream repo we cite throughout the course.
const UPSTREAM = "https://github.com/ZcashFoundation/zebra";
// Pin every code embed to this ref so the site cannot bit-rot.
const CODE_REF = "v4.4.1";

const config: Config = {
  title: "Zebra Onboarding",
  tagline: "A personal, code-anchored course on the Zcash full node in Rust.",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: `https://${FORK_OWNER}.github.io`,
  baseUrl: `/${FORK_REPO}/`,

  organizationName: FORK_OWNER,
  projectName: FORK_REPO,
  trailingSlash: false,

  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",

  markdown: {
    format: "detect",
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  customFields: {
    upstreamRepo: UPSTREAM,
    codeRef: CODE_REF,
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: `https://github.com/${FORK_OWNER}/${FORK_REPO}/edit/onboarding/onboarding/`,
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  stylesheets: [
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
      type: "text/css",
      integrity:
        "sha384-nB0miv6/jRmo5EGIE6RDQE0etf4GvjBR1bkf4pcUk2TprLGa0k7/rJkRnCu6WSt6",
      crossorigin: "anonymous",
    },
  ],

  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        indexBlog: false,
        indexPages: true,
        language: ["en"],
        highlightSearchTermsOnTargetPage: true,
      },
    ],
    "docusaurus-theme-github-codeblock",
  ],

  themeConfig: {
    announcementBar: {
      id: "ai-generated-disclaimer",
      content:
        'This site is auto-generated with Claude Code and may be wrong. The code in the Zebra repository is the law. Always cross-check against <a href="https://github.com/ZcashFoundation/zebra">ZcashFoundation/zebra</a> and the <a href="https://zips.z.cash/protocol/protocol.pdf">Zcash protocol spec</a>.',
      backgroundColor: "#fef3c7",
      textColor: "#78350f",
      isCloseable: false,
    },

    colorMode: {
      respectPrefersColorScheme: true,
    },

    navbar: {
      title: "Zebra Onboarding",
      logo: {
        alt: "Zebra Onboarding",
        src: "img/favicon.ico",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Course",
        },
        {
          href: `https://github.com/${FORK_OWNER}/${FORK_REPO}/tree/onboarding/onboarding`,
          label: "Fork (onboarding branch)",
          position: "right",
        },
        {
          href: UPSTREAM,
          label: "Upstream",
          position: "right",
        },
      ],
    },

    footer: {
      style: "dark",
      links: [
        {
          title: "Source",
          items: [
            {
              label: "This course (onboarding branch)",
              href: `https://github.com/${FORK_OWNER}/${FORK_REPO}/tree/onboarding/onboarding`,
            },
            {
              label: "Upstream Zebra",
              href: UPSTREAM,
            },
          ],
        },
        {
          title: "Specifications",
          items: [
            {
              label: "Zcash protocol spec (PDF)",
              href: "https://zips.z.cash/protocol/protocol.pdf",
            },
            {
              label: "ZIPs index",
              href: "https://zips.z.cash/",
            },
            {
              label: "Halo2 book",
              href: "https://zcash.github.io/halo2/",
            },
          ],
        },
      ],
      copyright: `Zebra Onboarding course. Code excerpts (c) the Zcash Foundation, MIT or Apache-2.0. Pinned to ${CODE_REF}.`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["rust", "bash", "toml", "json", "yaml", "diff"],
    },

    codeblock: {
      showGithubLink: true,
      githubLinkLabel: "View on GitHub",
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

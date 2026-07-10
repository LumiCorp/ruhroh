import { defineConfig } from "vitepress";

const siteUrl = "https://lumicorp.github.io/ruhroh/";
const siteTitle = "Ruhroh";
const siteDescription = "See what coding agents actually deliver.";
const socialDescription = "Run realistic software tasks, inspect the finished work and agent journey, compare repeated outcomes, and improve what happens next.";
const socialTitle = `${siteTitle}: ${siteDescription}`;
const socialImage = "https://lumicorp.github.io/ruhroh/ruhroh-social-card-v2.png";

export default defineConfig({
  title: siteTitle,
  description: siteDescription,
  base: "/ruhroh/",
  cleanUrls: true,
  head: [
    ["link", { rel: "canonical", href: siteUrl }],
    ["link", { rel: "image_src", href: socialImage }],
    ["link", { rel: "icon", href: "/ruhroh/ruhroh-badge.png" }],
    [
      "link",
      {
        rel: "icon",
        href: "/ruhroh/ruhroh-badge-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    ["meta", { name: "description", content: socialDescription }],
    ["meta", { itemprop: "name", content: socialTitle }],
    ["meta", { itemprop: "description", content: socialDescription }],
    ["meta", { itemprop: "image", content: socialImage }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: siteTitle }],
    ["meta", { property: "og:title", content: socialTitle }],
    ["meta", { property: "og:description", content: socialDescription }],
    ["meta", { property: "og:url", content: siteUrl }],
    ["meta", { property: "og:image", content: socialImage }],
    ["meta", { property: "og:image:url", content: socialImage }],
    ["meta", { property: "og:image:secure_url", content: socialImage }],
    ["meta", { property: "og:image:type", content: "image/png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: "Ruhroh: see what coding agents actually deliver" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: socialTitle }],
    ["meta", { name: "twitter:description", content: socialDescription }],
    ["meta", { name: "twitter:image", content: socialImage }],
    ["meta", { name: "twitter:image:alt", content: "Ruhroh: see what coding agents actually deliver" }],
  ],
  themeConfig: {
    logo: {
      light: "/ruhroh-badge.png",
      dark: "/ruhroh-badge-dark.png",
      alt: "Ruhroh",
    },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Reports", link: "/report-gallery" },
      { text: "Reference", link: "/cli-reference" },
      { text: "Lumi", link: "https://www.lumicorp.ai" },
      { text: "GitHub", link: "https://github.com/LumiCorp/ruhroh" },
      { text: "npm", link: "https://www.npmjs.com/package/@kestrel-agents/ruhroh" },
    ],
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Core Concepts", link: "/concepts" },
          { text: "Report Gallery", link: "/report-gallery" },
          { text: "Add to Existing Project", link: "/add-to-existing-project" },
          { text: "Local Fixture Run", link: "/local-fixture-run" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Build Evaluations",
        items: [
          { text: "Publish a Benchmark Result", link: "/benchmark-pack-tutorial" },
          { text: "Write a Task", link: "/write-a-scenario" },
          { text: "Task File Format", link: "/scenario-format" },
          { text: "Task Versioning", link: "/scenario-evolution" },
          { text: "Benchmark Suites", link: "/benchmark-suites" },
          { text: "Benchmark Suite Review", link: "/benchmark-pack-registry" },
          { text: "Connect an Agent", link: "/write-an-adapter" },
          { text: "Agent Connector Examples", link: "/adapter-examples" },
          { text: "Write a Reviewer", link: "/write-an-evaluator" },
          { text: "Reviewer Recipes", link: "/evaluator-cookbook" },
          { text: "Run a Shell Agent", link: "/custom-shell" },
        ],
      },
      {
        text: "Understand Results",
        items: [
          { text: "Evidence Files", link: "/artifacts" },
          { text: "Reviewer Command", link: "/eval-agent" },
          { text: "Human Review", link: "/adjudication" },
          { text: "Benchmark Methodology", link: "/benchmark-methodology" },
          { text: "Publish Claims", link: "/publish-claims" },
          { text: "Claim Registry", link: "/claim-registry" },
        ],
      },
      {
        text: "Operate",
        items: [
          { text: "Harbor", link: "/harbor" },
          { text: "CI", link: "/ci" },
          { text: "Distributed Runs", link: "/distributed-runs" },
          { text: "Security", link: "/security" },
          { text: "Limitations", link: "/limitations" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "CLI Reference", link: "/cli-reference" },
          { text: "Programmatic API", link: "/programmatic-api" },
          { text: "Agent Command Protocol", link: "/adapter-protocol" },
          { text: "Result JSON Reference", link: "/result-json-reference" },
          { text: "Contract Evolution", link: "/contract-evolution" },
          { text: "Public Repo Layout", link: "/public-repo-layout" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/LumiCorp/ruhroh" },
    ],
    search: {
      provider: "local",
    },
  },
});

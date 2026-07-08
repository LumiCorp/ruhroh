import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Ruhroh",
  description: "Audit-first benchmark framework for real coding-agent delivery",
  base: "/ruhroh/",
  cleanUrls: true,
  ignoreDeadLinks: [
    /^\/ruhroh\/samples\//,
  ],
  head: [
    ["link", { rel: "icon", href: "/ruhroh/ruhroh-badge.png" }],
    [
      "link",
      {
        rel: "icon",
        href: "/ruhroh/ruhroh-badge-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  ],
  themeConfig: {
    logo: {
      light: "/ruhroh-badge.png",
      dark: "/ruhroh-badge-dark.png",
      alt: "Ruhroh",
    },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Reference", link: "/architecture" },
      { text: "GitHub", link: "https://github.com/LumiCorp/ruhroh" },
      { text: "npm", link: "https://www.npmjs.com/package/@kestrel-agents/ruhroh" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Core Concepts", link: "/concepts" },
          { text: "Add to Existing Project", link: "/add-to-existing-project" },
          { text: "Local Fixture Run", link: "/local-fixture-run" },
          { text: "Benchmark Pack Tutorial", link: "/benchmark-pack-tutorial" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Authoring",
        items: [
          { text: "Write a Scenario", link: "/write-a-scenario" },
          { text: "Scenario Format", link: "/scenario-format" },
          { text: "Scenario Evolution", link: "/scenario-evolution" },
          { text: "Benchmark Suites", link: "/benchmark-suites" },
          { text: "Benchmark Methodology", link: "/benchmark-methodology" },
          { text: "Benchmark Pack Registry", link: "/benchmark-pack-registry" },
          { text: "Write an Adapter", link: "/write-an-adapter" },
          { text: "Adapter Examples", link: "/adapter-examples" },
          { text: "Write an Evaluator", link: "/write-an-evaluator" },
          { text: "Evaluator Cookbook", link: "/evaluator-cookbook" },
          { text: "Custom Shell", link: "/custom-shell" },
        ],
      },
      {
        text: "Runtime",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Harbor", link: "/harbor" },
          { text: "Eval Agent", link: "/eval-agent" },
          { text: "Adjudication", link: "/adjudication" },
          { text: "Artifacts", link: "/artifacts" },
          { text: "Report Gallery", link: "/report-gallery" },
          { text: "Publish Claims", link: "/publish-claims" },
          { text: "Claim Registry", link: "/claim-registry" },
        ],
      },
      {
        text: "Operations",
        items: [
          { text: "CI", link: "/ci" },
          { text: "Distributed Runs", link: "/distributed-runs" },
          { text: "Security", link: "/security" },
          { text: "Limitations", link: "/limitations" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI Reference", link: "/cli-reference" },
          { text: "Programmatic API", link: "/programmatic-api" },
          { text: "Adapter Protocol", link: "/adapter-protocol" },
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

import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Ruhroh",
  description: "Real-User Harness for Repair-Oriented Harbor",
  base: "/ruhroh/",
  cleanUrls: true,
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
          { text: "Local Fixture Run", link: "/local-fixture-run" },
        ],
      },
      {
        text: "Authoring",
        items: [
          { text: "Write a Scenario", link: "/write-a-scenario" },
          { text: "Scenario Format", link: "/scenario-format" },
          { text: "Benchmark Suites", link: "/benchmark-suites" },
          { text: "Benchmark Methodology", link: "/benchmark-methodology" },
          { text: "Write an Adapter", link: "/write-an-adapter" },
          { text: "Custom Shell", link: "/custom-shell" },
        ],
      },
      {
        text: "Runtime",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Harbor", link: "/harbor" },
          { text: "Eval Agent", link: "/eval-agent" },
          { text: "Artifacts", link: "/artifacts" },
          { text: "Result JSON", link: "/result-json-reference" },
        ],
      },
      {
        text: "Operations",
        items: [
          { text: "CI", link: "/ci" },
          { text: "Security", link: "/security" },
          { text: "Limitations", link: "/limitations" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI Reference", link: "/cli-reference" },
          { text: "Adapter Protocol", link: "/adapter-protocol" },
          { text: "Result JSON Reference", link: "/result-json-reference" },
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

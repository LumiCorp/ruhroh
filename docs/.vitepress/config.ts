import { defineConfig } from "vitepress";

const cleanSampleReports = new Set([
  "/ruhroh/samples/ruhroh-workflow",
  "/ruhroh/samples/ruhroh-report",
  "/ruhroh/samples/ruhroh-review",
  "/ruhroh/samples/ruhroh-eval-quality",
  "/ruhroh/samples/ruhroh-compare",
  "/ruhroh/samples/ruhroh-claims",
  "/ruhroh/samples/ruhroh-publication/ruhroh-compare",
  "/ruhroh/samples/ruhroh-publication/ruhroh-eval-quality",
  "/ruhroh/samples/ruhroh-publication/ruhroh-review",
]);

const siteUrl = "https://lumicorp.github.io/ruhroh/";
const siteTitle = "Ruhroh";
const siteDescription = "Evidence-backed benchmarks for coding agents.";
const socialDescription = "Run coding agents on realistic software work, save the evidence, and compare benchmark results reviewers can inspect.";
const socialTitle = `${siteTitle}: ${siteDescription}`;
const socialImage = "https://lumicorp.github.io/ruhroh/ruhroh-social-card-v2.png";

export default defineConfig({
  title: siteTitle,
  description: siteDescription,
  base: "/ruhroh/",
  cleanUrls: true,
  vite: {
    plugins: [{
      name: "ruhroh-clean-sample-report-urls",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const originalUrl = request.url ?? "";
          const [pathname, query] = originalUrl.split("?");
          if (pathname !== undefined && cleanSampleReports.has(pathname)) {
            request.url = `${pathname}.html${query === undefined ? "" : `?${query}`}`;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, _response, next) => {
          const originalUrl = request.url ?? "";
          const [pathname, query] = originalUrl.split("?");
          if (pathname !== undefined && cleanSampleReports.has(pathname)) {
            request.url = `${pathname}.html${query === undefined ? "" : `?${query}`}`;
          }
          next();
        });
      },
    }],
  },
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
    ["meta", { property: "og:image:alt", content: "Ruhroh: evidence-backed benchmarks for coding agents" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: socialTitle }],
    ["meta", { name: "twitter:description", content: socialDescription }],
    ["meta", { name: "twitter:image", content: socialImage }],
    ["meta", { name: "twitter:image:alt", content: "Ruhroh: evidence-backed benchmarks for coding agents" }],
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
          { text: "Publish a Benchmark Result", link: "/benchmark-pack-tutorial" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Authoring",
        items: [
          { text: "Write a Task", link: "/write-a-scenario" },
          { text: "Task File Format", link: "/scenario-format" },
          { text: "Task Versioning", link: "/scenario-evolution" },
          { text: "Benchmark Suites", link: "/benchmark-suites" },
          { text: "Benchmark Methodology", link: "/benchmark-methodology" },
          { text: "Benchmark Suite Review", link: "/benchmark-pack-registry" },
          { text: "Connect an Agent", link: "/write-an-adapter" },
          { text: "Agent Connector Examples", link: "/adapter-examples" },
          { text: "Write a Reviewer", link: "/write-an-evaluator" },
          { text: "Reviewer Recipes", link: "/evaluator-cookbook" },
          { text: "Run a Shell Agent", link: "/custom-shell" },
        ],
      },
      {
        text: "Evidence",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Harbor", link: "/harbor" },
          { text: "Reviewer Command", link: "/eval-agent" },
          { text: "Human Review", link: "/adjudication" },
          { text: "Evidence Files", link: "/artifacts" },
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

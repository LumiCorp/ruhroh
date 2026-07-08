# Security

Ruhroh handles untrusted benchmark material and untrusted agent output.

Security-sensitive reports should avoid public exploit details when they involve
credential exposure, unsafe workspace mutation, or code execution beyond the
intended benchmark workspace. Open a minimal GitHub issue asking for maintainer
contact, or contact a project maintainer through the owning organization.

Please include:

- affected package version;
- exact command or scenario involved;
- what boundary was crossed or could be crossed;
- whether credentials, private files, or external services were exposed.

General rules are documented in [`docs/security.md`](docs/security.md):

- treat prompts and assets as untrusted input;
- run agents only in benchmark workspaces;
- keep secrets behind explicit environment allowlists;
- keep live credentialed agent runs out of default CI;
- review transcripts, workspace archives, copied `sources/`, publication
  bundles, and claim indexes before sharing them publicly.

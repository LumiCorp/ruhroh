Build a local-only bookmark manager in this workspace.

The app should let a user:

- add a bookmark with title, URL, and optional notes;
- see the saved bookmark list;
- search saved bookmarks by title, URL, or notes;
- delete a saved bookmark;
- keep bookmarks after page refresh using browser localStorage or an equivalent browser-local persistence mechanism.

Keep the app self-contained for local deployment. Do not add a backend service, database, hosted API, or external network dependency.

Preserve the existing `pnpm dev` and `pnpm test` commands. Make `pnpm test` pass before you finish.

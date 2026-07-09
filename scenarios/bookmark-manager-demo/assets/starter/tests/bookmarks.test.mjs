import assert from "node:assert/strict";
import test from "node:test";

import { createBookmarkStore } from "../src/bookmarks.js";

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

test("adds and lists bookmarks with stable ids", () => {
  const store = createBookmarkStore(memoryStorage());
  const bookmark = store.add({ title: "Ruhroh", url: "https://example.com", notes: "agent evals" });

  assert.equal(typeof bookmark.id, "string");
  assert.deepEqual(store.list(), [bookmark]);
});

test("searches title, url, and notes", () => {
  const store = createBookmarkStore(memoryStorage());
  store.add({ title: "Ruhroh", url: "https://example.com", notes: "agent evals" });
  store.add({ title: "Docs", url: "https://docs.example.com", notes: "reference" });

  assert.equal(store.search("ruhroh").length, 1);
  assert.equal(store.search("docs.example").length, 1);
  assert.equal(store.search("reference").length, 1);
});

test("deletes bookmarks by id", () => {
  const store = createBookmarkStore(memoryStorage());
  const first = store.add({ title: "One", url: "https://one.example", notes: "" });
  store.add({ title: "Two", url: "https://two.example", notes: "" });

  assert.equal(store.remove(first.id), true);
  assert.deepEqual(store.list().map((bookmark) => bookmark.title), ["Two"]);
});

test("persists bookmarks through storage", () => {
  const storage = memoryStorage();
  const firstStore = createBookmarkStore(storage);
  firstStore.add({ title: "Saved", url: "https://saved.example", notes: "persist me" });

  const secondStore = createBookmarkStore(storage);
  assert.deepEqual(secondStore.list().map((bookmark) => bookmark.title), ["Saved"]);
});

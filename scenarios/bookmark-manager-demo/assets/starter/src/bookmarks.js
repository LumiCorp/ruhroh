export function createBookmarkStore(storage = globalThis.localStorage) {
  const storageKey = "ruhroh.demo.bookmarks";

  function read() {
    return [];
  }

  function write(_bookmarks) {
    return undefined;
  }

  return {
    list() {
      return read();
    },
    add(_bookmark) {
      throw new Error("TODO: add bookmark");
    },
    search(_query) {
      return read();
    },
    remove(_id) {
      return false;
    },
    clear() {
      write([]);
    }
  };
}

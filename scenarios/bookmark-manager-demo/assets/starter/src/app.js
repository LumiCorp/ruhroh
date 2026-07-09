import { createBookmarkStore } from "./bookmarks.js";

const store = createBookmarkStore();

const form = document.querySelector("#bookmark-form");
const titleInput = document.querySelector("#title-input");
const urlInput = document.querySelector("#url-input");
const notesInput = document.querySelector("#notes-input");
const searchInput = document.querySelector("#search-input");
const list = document.querySelector("#bookmark-list");

function render() {
  const query = searchInput.value;
  const bookmarks = query ? store.search(query) : store.list();
  list.innerHTML = "";
  for (const bookmark of bookmarks) {
    const item = document.createElement("li");
    item.textContent = bookmark.title ?? bookmark.url ?? "Untitled bookmark";
    list.append(item);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  store.add({
    title: titleInput.value,
    url: urlInput.value,
    notes: notesInput.value
  });
  form.reset();
  render();
});

searchInput.addEventListener("input", render);
render();

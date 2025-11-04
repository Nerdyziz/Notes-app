const el = (id) => document.getElementById(id);
const title = el("noteTitle"),
  input = el("noteInput"),
  notesList = el("notesList");
const wordCount = el("wordCount"),
  charCount = el("charCount");
const suggestBox = el("suggestions"),
  search = el("searchNotes");
let notes = [],
  activeId = null,
  words = [],
  autosave = null,
  lastQuery = "";
let autocompleteTimer = null;

const saveStore = () => localStorage.setItem("notes", JSON.stringify(notes));
const loadStore = () => JSON.parse(localStorage.getItem("notes") || "[]");

const updateCount = () => {
  const txt = input.value.trim();
  wordCount.innerHTML = `${txt ? txt.split(/\s+/).length : 0} words`;
  charCount.innerHTML = `${input.value.length} chars`;
};

const renderList = (filter = "") => {
  notesList.innerHTML = "";
  notes
    .filter((n) =>
      (n.title + n.content).toLowerCase().includes(filter.toLowerCase())
    )
    .forEach((n) => {
      const d = document.createElement("div");
      d.className = "note-item" + (n.id === activeId ? " active" : "");
      d.innerHTML =
        (n.title || "(untitled)") +
        "<br>" +
        (n.updated ? new Date(n.updated).toLocaleString() : "");

      d.onclick = () => open(n.id);
      notesList.appendChild(d);
    });
};

const open = (id) => {
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  activeId = id;
  title.value = n.title;
  input.value = n.content;
  updateCount();
  renderList(search.value);
};

const newNote = () => {
  const n = {
    id: Date.now().toString(),
    title: "",
    content: "",
    updated: Date.now(),
  };
  notes.unshift(n);
  activeId = n.id;
  title.value = input.value = "";
  saveStore();
  renderList();
};

const saveNote = () => {
  if (!activeId) return newNote();

  const n = notes.find((x) => x.id === activeId);
  if (!n) return;

  n.title = title.value;
  n.content = input.value;
  n.updated = Date.now();

  notes.sort((a, b) => b.updated - a.updated);

  saveStore();

  renderList(search.value);
};

const deleteNote = () => {
  if (!activeId || !confirm("Delete this note?")) return;
  notes = notes.filter((x) => x.id !== activeId);
  activeId = notes[0]?.id || null;
  activeId ? open(activeId) : (title.value = input.value = "");
  saveStore();
  renderList();
};

// ----------------- Binary Search -----------------
const lowerBound = (arr, prefix) => {
  let lo = 0,
    hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    arr[mid] < prefix ? (lo = mid + 1) : (hi = mid);
  }
  return lo;
};

// ----------------- LCS Function ------------------
function LCS(a, b) {
  const m = a.length,
    n = b.length,
    dp = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

const getSuggestions = (prefix) => {
  if (!prefix) return [];
  const [s, e] = [
    lowerBound(words, prefix),
    lowerBound(words, prefix + "\uffff"),
  ];
  const slice = words.slice(s, e);
  if (slice.length) return slice.slice(0, 10);

  return words
    .map((w) => ({
      w,
      score:
        LCS(prefix, w) -
        Math.abs(w.length - prefix.length) * 0.5 +
        (w.startsWith(prefix[0]) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => x.w);
};

const showSuggestions = (list) => {
  suggestBox.innerHTML = "";
  if (!list.length) {
    suggestBox.style.display = "none";
    return;
  }
  list.forEach((w) => {
    const li = document.createElement("li");
    li.textContent = w;
    li.onclick = () => replaceWord(w);
    suggestBox.appendChild(li);
  });
  const r = document.querySelector(".editor").getBoundingClientRect();
  suggestBox.style.top = r.top + 100 + "px";
  suggestBox.style.left = r.right - 270 + "px";
  suggestBox.style.display = "block";
};

const replaceWord = (w) => {
  const pos = input.selectionStart;
  const before = input.value.slice(0, pos),
    after = input.value.slice(pos);
  const m = before.search(/\S+$/);
  const newBefore = m !== -1 ? before.slice(0, m) + w : before + w;
  input.value = newBefore + after;
  const newPos = (m !== -1 ? m : before.length) + w.length;
  input.setSelectionRange(newPos, newPos);
  saveNote();
  updateCount();
  suggestBox.style.display = "none";
  input.focus();
};

const handleAuto = () => {
  const pos = input.selectionStart;
  const token = input.value
    .slice(0, pos)
    .match(/(\S+)$/)?.[1]
    ?.toLowerCase();
  if (!token || token.length < 2 || token === lastQuery)
    return (suggestBox.style.display = "none");
  lastQuery = token;
  showSuggestions(getSuggestions(token));
};

input.addEventListener("input", () => {
  clearTimeout(autosave);
  clearTimeout(autocompleteTimer);
  autosave = setTimeout(saveNote, 700);
  updateCount();
  autocompleteTimer = setTimeout(handleAuto, 150);
});
title.addEventListener("input", () => {
  clearTimeout(autosave);
  autosave = setTimeout(saveNote, 700);
});
search.addEventListener("input", (e) => renderList(e.target.value));
document.addEventListener("click", (e) => {
  if (!suggestBox.contains(e.target) && e.target !== input)
    suggestBox.style.display = "none";
});
el("newBtn").onclick = newNote;
el("saveBtn").onclick = saveNote;
el("deleteBtn").onclick = deleteNote;

(async () => {
  notes = loadStore();
  if (!notes.length) {
    notes = [
      {
        id: Date.now().toString(),
        title: "Welcome",
        content: "Start typing to see LCS + Binary Search autocomplete!",
        updated: Date.now(),
      },
    ];
  }
  activeId = notes[0].id;
  open(activeId);
  renderList();
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
    );
    words = (await res.text())
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .sort();
  } catch {
    words = [
      "apple",
      "banana",
      "note",
      "notebook",
      "network",
      "project",
      "study",
      "program",
      "meeting",
      "todo",
    ];
  }
})();

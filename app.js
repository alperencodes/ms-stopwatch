"use strict";

const timer = document.querySelector("#timer");
const status = document.querySelector("#status");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const resetButton = document.querySelector("#resetButton");
const undoButton = document.querySelector("#undoButton");
const notesList = document.querySelector("#notesList");
const noteCount = document.querySelector("#noteCount");
const metadataForm = document.querySelector("#metadataForm");

let running = false;
let startedAt = 0;
let elapsedBeforeStart = 0;
let animationFrame = 0;
let notes = [];

function elapsedMs() {
  return Math.round(elapsedBeforeStart + (running ? performance.now() - startedAt : 0));
}

function drawTimer() {
  timer.value = `${elapsedMs()} ms`;
  timer.textContent = timer.value;
  if (running) animationFrame = requestAnimationFrame(drawTimer);
}

function setRunning(nextRunning) {
  running = nextRunning;
  startButton.disabled = running;
  stopButton.disabled = !running;
  startButton.textContent = elapsedBeforeStart > 0 ? "Resume" : "Start";
}

function start() {
  if (running) return;
  startedAt = performance.now();
  setRunning(true);
  status.textContent = "Running — press Space, Y, Z, or X to record notes";
  drawTimer();
}

function stop() {
  if (!running) return;
  elapsedBeforeStart = elapsedMs();
  cancelAnimationFrame(animationFrame);
  setRunning(false);
  drawTimer();
  status.textContent = `Stopped at ${elapsedBeforeStart} ms — resume or save when finished`;
}

function reset() {
  if ((elapsedMs() > 0 || notes.length) && !window.confirm("Reset the timer and delete all recorded notes?")) return;
  cancelAnimationFrame(animationFrame);
  running = false;
  startedAt = 0;
  elapsedBeforeStart = 0;
  notes = [];
  setRunning(false);
  drawTimer();
  renderNotes();
  status.textContent = "Ready";
}

function renderNotes() {
  noteCount.textContent = String(notes.length);
  undoButton.disabled = notes.length === 0;
  notesList.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No notes yet. Start the timer and press Space, Y, Z, or X.";
    notesList.append(empty);
    return;
  }
  notes.forEach((time, index) => {
    const item = document.createElement("li");
    item.textContent = `Note ${index + 1} — ${time} ms`;
    notesList.append(item);
  });
  notesList.scrollTop = notesList.scrollHeight;
}

function recordNote() {
  const time = elapsedMs();
  notes.push(time);
  renderNotes();
  status.textContent = `Recorded note ${notes.length} at ${time} ms`;
}

function makeBeatmap() {
  return {
    song: document.querySelector("#song").value.trim(),
    artist: document.querySelector("#artist").value.trim(),
    difficulty: document.querySelector("#difficulty").value,
    bpm: Number(document.querySelector("#bpm").value),
    approachTimeMs: Number(document.querySelector("#approachTimeMs").value),
    notes: notes.map((time) => ({ time, lane: "" }))
  };
}

function safeFilename(song) {
  const name = song.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${name || "beatmap"}.json`;
}

async function saveJson(beatmap) {
  const contents = `${JSON.stringify(beatmap, null, 2)}\n`;
  const filename = safeFilename(beatmap.song);

  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "JSON beatmap", accept: { "application/json": [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

startButton.addEventListener("click", start);
stopButton.addEventListener("click", stop);
resetButton.addEventListener("click", reset);
undoButton.addEventListener("click", () => {
  notes.pop();
  renderNotes();
  status.textContent = notes.length ? `Removed last note — ${notes.length} remaining` : "All notes removed";
});

document.addEventListener("keydown", (event) => {
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
  const recordKey = event.code === "Space" || ["y", "z", "x"].includes(event.key.toLowerCase());
  if (!recordKey || event.repeat || editing) return;
  event.preventDefault();
  if (running) recordNote();
});

metadataForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running) {
    status.textContent = "Stop the timer before saving.";
    return;
  }
  if (!metadataForm.reportValidity()) return;
  try {
    await saveJson(makeBeatmap());
    status.textContent = "Beatmap JSON saved.";
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      status.textContent = "The JSON could not be saved. Please try again.";
    }
  }
});

drawTimer();
renderNotes();

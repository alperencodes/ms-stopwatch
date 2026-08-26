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
const songSelect = document.querySelector("#songSelect");
const songAudio = document.querySelector("#songAudio");
const volumeSlider = document.querySelector("#volumeSlider");
const volumeValue = document.querySelector("#volumeValue");
const timelineSlider = document.querySelector("#timelineSlider");
const timelineValue = document.querySelector("#timelineValue");

let running = false;
let starting = false;
let startedAt = 0;
let elapsedBeforeStart = 0;
let animationFrame = 0;
let notes = [];

function elapsedMs() {
  if (songSelect.value) return Math.round(songAudio.currentTime * 1000);
  return Math.round(elapsedBeforeStart + (running ? performance.now() - startedAt : 0));
}

function formatTimeline(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const wholeSeconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function drawTimeline() {
  const duration = Number.isFinite(songAudio.duration) ? songAudio.duration : 0;
  timelineSlider.value = String(Math.min(songAudio.currentTime || 0, duration));
  timelineValue.value = `${formatTimeline(songAudio.currentTime)} / ${formatTimeline(duration)}`;
  timelineValue.textContent = timelineValue.value;
}

function renderDisplays() {
  timer.value = `${elapsedMs()} ms`;
  timer.textContent = timer.value;
  drawTimeline();
}

function drawTimer() {
  renderDisplays();
  if (running) animationFrame = requestAnimationFrame(drawTimer);
}

function setRunning(nextRunning) {
  running = nextRunning;
  startButton.disabled = running;
  stopButton.disabled = !running;
  songSelect.disabled = running;
  startButton.textContent = elapsedBeforeStart > 0 ? "Resume" : "Start";
}

async function start() {
  if (running || starting) return;
  starting = true;
  startButton.disabled = true;
  resetButton.disabled = true;
  songSelect.disabled = true;

  if (songSelect.value) {
    try {
      songAudio.currentTime = elapsedBeforeStart / 1000;
      status.textContent = "Starting song…";
      await songAudio.play();
    } catch (error) {
      console.error(error);
      status.textContent = "The selected song could not be played.";
      starting = false;
      startButton.disabled = false;
      resetButton.disabled = false;
      songSelect.disabled = false;
      return;
    }
  }

  startedAt = performance.now();
  setRunning(true);
  starting = false;
  resetButton.disabled = false;
  status.textContent = "Running — press Y, Z, or X to record notes; Space to pause";
  drawTimer();
}

function stop() {
  if (!running) return;
  elapsedBeforeStart = elapsedMs();
  songAudio.pause();
  cancelAnimationFrame(animationFrame);
  setRunning(false);
  drawTimer();
  status.textContent = `Stopped at ${elapsedBeforeStart} ms — resume or save when finished`;
}

function reset() {
  if ((elapsedMs() > 0 || notes.length) && !window.confirm("Reset the timer and delete all recorded notes?")) return;
  cancelAnimationFrame(animationFrame);
  songAudio.pause();
  songAudio.currentTime = 0;
  running = false;
  starting = false;
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
    empty.textContent = "No notes yet. Start the timer and press Y, Z, or X.";
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
volumeSlider.addEventListener("input", () => {
  songAudio.volume = Number(volumeSlider.value) / 100;
  volumeValue.value = `${volumeSlider.value}%`;
  volumeValue.textContent = volumeValue.value;
});
timelineSlider.addEventListener("input", () => {
  songAudio.currentTime = Number(timelineSlider.value);
  elapsedBeforeStart = Math.round(songAudio.currentTime * 1000);
  renderDisplays();
  if (!running) status.textContent = `Moved to ${elapsedBeforeStart} ms`;
});
songSelect.addEventListener("change", () => {
  songAudio.pause();
  if (songSelect.value) {
    timelineSlider.disabled = true;
    songAudio.src = songSelect.value;
    songAudio.onloadedmetadata = () => {
      timelineSlider.max = String(songAudio.duration);
      timelineSlider.disabled = false;
      songAudio.currentTime = Math.min(elapsedBeforeStart / 1000, songAudio.duration || 0);
      drawTimer();
    };
    songAudio.load();
    status.textContent = `Selected ${songSelect.options[songSelect.selectedIndex].text}`;
  } else {
    songAudio.onloadedmetadata = null;
    songAudio.removeAttribute("src");
    songAudio.load();
    timelineSlider.max = "0";
    timelineSlider.value = "0";
    timelineSlider.disabled = true;
    status.textContent = "No playback song selected";
  }
  drawTimer();
});
songAudio.addEventListener("ended", () => {
  if (!running) return;
  elapsedBeforeStart = Math.round(songAudio.duration * 1000);
  cancelAnimationFrame(animationFrame);
  setRunning(false);
  drawTimer();
  status.textContent = `Song finished at ${elapsedBeforeStart} ms`;
});
undoButton.addEventListener("click", () => {
  notes.pop();
  renderNotes();
  status.textContent = notes.length ? `Removed last note — ${notes.length} remaining` : "All notes removed";
});

document.addEventListener("keydown", (event) => {
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
  if (event.repeat || editing) return;

  if (event.code === "Space") {
    event.preventDefault();
    if (running) stop();
    else start();
    return;
  }

  const recordKey = ["y", "z", "x"].includes(event.key.toLowerCase());
  if (!recordKey) return;
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

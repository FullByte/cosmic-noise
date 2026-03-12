import { STRINGS, t } from "./i18n.js";
import { STAGES } from "./stages.js";
import { loadSave, saveState, clearSave } from "./storage.js";
import { createInitialState, serializeState, defaultControls } from "./state.js";
import { COMPLETION_CLARITY, COMPLETION_CONFIDENCE, evaluateSignal } from "./signal-engine.js";
import { createRenderer } from "./render.js";
import { wireControls } from "./controls.js";
import { ensureAudioStarted, updateAudio } from "./audio.js";

const state = createInitialState(loadSave());
const canvas = document.getElementById("signal-canvas");
const renderer = createRenderer(canvas);

const confidenceMeter = document.getElementById("confidence-meter");
const confidenceLabel = document.getElementById("confidence-label");
const clarityLabel = document.getElementById("clarity-label");
const debugFit = document.getElementById("debug-fit");
const debugNoise = document.getElementById("debug-noise");
const debugCurve = document.getElementById("debug-curve");
const outputScreen = document.getElementById("signal-output");
const hintOutput = document.getElementById("hint-output");
const completionStatus = document.getElementById("completion-status");
const codewordInput = document.getElementById("codeword-input");
const codewordSubmit = document.getElementById("codeword-submit");
const stageChip = document.getElementById("stage-chip");
const attemptLabel = document.getElementById("attempt-label");
const nextStageBtn = document.getElementById("next-stage");

const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialTitle = document.getElementById("tutorial-title");
const tutorialBody = document.getElementById("tutorial-body");
const tutorialPrev = document.getElementById("tutorial-prev");
const tutorialNext = document.getElementById("tutorial-next");
const tutorialSkip = document.getElementById("tutorial-skip");

let tutorialStep = 0;

const ui = wireControls({
  state,
  onChange: () => {
    save();
  },
  onScan: scanSignal,
  onAddPatch: (route) => {
    if (!state.controls.patches.includes(route)) {
      state.controls.patches.push(route);
    }
  },
  onClearPatches: () => {
    state.controls.patches = [];
  },
  onNextStage: advanceStage,
  onToggleLang: toggleLanguage,
  onToggleAudio: toggleAudio,
  onResetProgress: resetProgress,
});

function currentStage() {
  return STAGES[state.stageIndex];
}

function save() {
  saveState(serializeState(state));
}

function applyLanguage() {
  const langStrings = STRINGS[state.language];
  document.documentElement.lang = state.language;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    node.textContent = langStrings[key] ?? key;
  });

  ui.setLangButtonLabel(state.language === "de" ? "EN" : "DE");
  ui.setAudioLabel(t(state.language, state.audioEnabled ? "audioOn" : "audioOff"));
}

function renderStatus() {
  const stage = currentStage();
  const stageCleared = state.justCompleted || state.stageIndex < state.maxUnlockedStage;

  stageChip.textContent = `${stage.name[state.language]} (${stage.id}/${STAGES.length})`;
  confidenceMeter.value = state.confidence;
  confidenceLabel.textContent = `${state.confidence}%`;
  clarityLabel.textContent = `${state.clarity}%`;
  attemptLabel.textContent = `${t(state.language, "attempts")}: ${state.attempts}`;
  completionStatus.textContent = `${t(state.language, "completionTarget")}: ${t(state.language, "clarity")} >= ${COMPLETION_CLARITY}% | ${t(state.language, "confidence")} >= ${COMPLETION_CONFIDENCE}% | ${t(state.language, "completionOrCodeword")} - ${stageCleared ? t(state.language, "completionReady") : t(state.language, "completionPending")}`;
  completionStatus.classList.toggle("ready", stageCleared);
  completionStatus.classList.toggle("pending", !stageCleared);
  nextStageBtn.disabled = !stageCleared && state.stageIndex >= state.maxUnlockedStage;

  if (!state.decodedText) {
    outputScreen.textContent = "...";
  } else {
    outputScreen.textContent = state.decodedText;
  }

  hintOutput.innerHTML = "";
  state.hints.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    p.style.margin = "0 0 4px";
    hintOutput.append(p);
  });
}

function scanSignal() {
  const stage = currentStage();
  const result = evaluateSignal(stage, state.controls, state.language, (key) => t(state.language, key));

  state.attempts += 1;
  state.clarity = result.clarity;
  state.confidence = result.confidence;
  state.decodedText = result.decoded;
  state.hints = result.hints;

  if (result.completed) {
    state.justCompleted = true;
    state.maxUnlockedStage = Math.max(state.maxUnlockedStage, Math.min(state.stageIndex + 1, STAGES.length - 1));
    state.hints.unshift(
      state.stageIndex === STAGES.length - 1 ? t(state.language, "finalComplete") : t(state.language, "stageComplete")
    );
  } else {
    state.justCompleted = false;
  }

  save();
  renderStatus();
}

function advanceStage() {
  if (!state.justCompleted && state.stageIndex >= state.maxUnlockedStage) {
    state.hints = [t(state.language, "statusLocked")];
    renderStatus();
    return;
  }

  const next = Math.min(state.stageIndex + 1, STAGES.length - 1);
  if (next === state.stageIndex) {
    return;
  }

  state.stageIndex = next;
  state.controls = defaultControls();
  state.attempts = 0;
  state.clarity = 0;
  state.confidence = 0;
  state.decodedText = "";
  state.hints = [];
  state.justCompleted = false;
  codewordInput.value = "";

  ui.syncControls();
  save();
  renderStatus();
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\u00c4/g, "AE")
    .replace(/\u00d6/g, "OE")
    .replace(/\u00dc/g, "UE")
    .replace(/\u1e9e/g, "SS")
    .replace(/\u00df/g, "SS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function submitCodeword() {
  const stage = currentStage();
  const expected = normalizeWord(stage.codeword?.[state.language] ?? stage.codeword?.en ?? "");
  const submitted = normalizeWord(codewordInput.value);

  if (!expected || !submitted) {
    return;
  }

  if (submitted === expected) {
    state.justCompleted = true;
    state.maxUnlockedStage = Math.max(state.maxUnlockedStage, Math.min(state.stageIndex + 1, STAGES.length - 1));
    state.hints.unshift(t(state.language, "codewordSuccess"));
    save();
    renderStatus();
    return;
  }

  state.hints.unshift(t(state.language, "codewordFail"));
  renderStatus();
}

function toggleLanguage() {
  state.language = state.language === "de" ? "en" : "de";
  applyLanguage();
  renderStatus();
  save();
}

async function toggleAudio() {
  if (!state.audioEnabled) {
    await ensureAudioStarted();
  }
  state.audioEnabled = !state.audioEnabled;
  ui.setAudioLabel(t(state.language, state.audioEnabled ? "audioOn" : "audioOff"));
  save();
}

function resetProgress() {
  if (!window.confirm(t(state.language, "resetAsk"))) {
    return;
  }

  clearSave();
  const fresh = createInitialState(null);
  Object.assign(state, fresh);
  applyLanguage();
  ui.syncControls();
  renderStatus();
  openTutorial();
}

function openTutorial() {
  tutorialStep = 0;
  tutorialOverlay.classList.add("visible");
  renderTutorial();
}

function closeTutorial() {
  tutorialOverlay.classList.remove("visible");
  state.tutorialSeen = true;
  save();
}

function renderTutorial() {
  const steps = STRINGS[state.language].tutorial;
  const item = steps[tutorialStep];
  tutorialTitle.textContent = item.title;
  tutorialBody.textContent = item.body;
  tutorialPrev.disabled = tutorialStep === 0;
  tutorialNext.textContent = tutorialStep === steps.length - 1 ? t(state.language, "tutorialDone") : t(state.language, "tutorialNext");
}

tutorialPrev.addEventListener("click", () => {
  tutorialStep = Math.max(0, tutorialStep - 1);
  renderTutorial();
});

tutorialNext.addEventListener("click", () => {
  const max = STRINGS[state.language].tutorial.length - 1;
  if (tutorialStep >= max) {
    closeTutorial();
    return;
  }
  tutorialStep += 1;
  renderTutorial();
});

tutorialSkip.addEventListener("click", closeTutorial);
codewordSubmit.addEventListener("click", submitCodeword);
codewordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitCodeword();
  }
});

function gameLoop() {
  const visual = renderer.draw({
    clarity: state.clarity,
    confidence: state.confidence,
    controls: state.controls,
    stage: currentStage(),
  });

  if (visual) {
    debugFit.textContent = `${Math.round(visual.fit * 100)}%`;
    debugNoise.textContent = `${Math.round(visual.noise * 100)}%`;
    debugCurve.textContent = `${Math.round(visual.curve * 100)}%`;
  }

  updateAudio({
    enabled: state.audioEnabled,
    confidence: state.confidence,
    stageIndex: state.stageIndex,
  });

  requestAnimationFrame(gameLoop);
}

applyLanguage();
ui.syncControls();
renderStatus();
if (!state.tutorialSeen) {
  openTutorial();
}

gameLoop();

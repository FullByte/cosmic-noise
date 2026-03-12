import { STAGES } from "./stages.js";

export function defaultControls() {
  return {
    power: false,
    phase: false,
    freq: 50,
    fine: 0,
    gain: 40,
    dial: 0,
    patches: [],
  };
}

export function createInitialState(saved) {
  const base = {
    language: "de",
    audioEnabled: false,
    stageIndex: 0,
    maxUnlockedStage: 0,
    attempts: 0,
    tutorialSeen: false,
    controls: defaultControls(),
    clarity: 0,
    confidence: 0,
    decodedText: "",
    hints: [],
    justCompleted: false,
  };

  if (!saved) {
    return base;
  }

  return {
    ...base,
    ...saved,
    stageIndex: clampStage(saved.stageIndex ?? 0),
    maxUnlockedStage: clampStage(saved.maxUnlockedStage ?? 0),
    controls: { ...defaultControls(), ...(saved.controls ?? {}) },
    hints: Array.isArray(saved.hints) ? saved.hints : [],
  };
}

export function clampStage(value) {
  return Math.max(0, Math.min(STAGES.length - 1, value));
}

export function serializeState(state) {
  return {
    language: state.language,
    audioEnabled: state.audioEnabled,
    stageIndex: state.stageIndex,
    maxUnlockedStage: state.maxUnlockedStage,
    attempts: state.attempts,
    tutorialSeen: state.tutorialSeen,
    controls: state.controls,
  };
}

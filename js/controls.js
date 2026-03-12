function dialDisplay(value) {
  return String(value).padStart(3, "0");
}

function renderPatches(listElement, patches) {
  listElement.innerHTML = "";
  if (!patches.length) {
    const item = document.createElement("li");
    item.textContent = "-";
    listElement.append(item);
    return;
  }

  patches.forEach((route, index) => {
    const item = document.createElement("li");
    item.textContent = `${index + 1}. ${route}`;
    listElement.append(item);
  });
}

function highlightPorts(patches) {
  const activePorts = new Set();
  for (const route of patches) {
    const [from, to] = route.split("->");
    activePorts.add(from);
    activePorts.add(to);
  }

  document.querySelectorAll(".port").forEach((node) => {
    const isActive = activePorts.has(node.dataset.port);
    node.classList.toggle("active", isActive);
  });
}

export function wireControls({ state, onChange, onAddPatch, onClearPatches, onToggleLang, onToggleAudio, onResetProgress }) {
  const powerSwitch = document.getElementById("power-switch");
  const phaseSwitch = document.getElementById("phase-switch");
  const freqKnob = document.getElementById("freq-knob");
  const fineKnob = document.getElementById("fine-knob");
  const gainKnob = document.getElementById("gain-knob");
  const freqValue = document.getElementById("freq-value");
  const fineValue = document.getElementById("fine-value");
  const gainValue = document.getElementById("gain-value");

  const dialValue = document.getElementById("dial-value");
  const dialDown = document.getElementById("dial-down");
  const dialUp = document.getElementById("dial-up");
  const dialGroup = document.getElementById("dial-group");

  const patchFrom = document.getElementById("patch-from");
  const patchTo = document.getElementById("patch-to");
  const patchAdd = document.getElementById("patch-add");
  const patchList = document.getElementById("patch-list");
  const patchClear = document.getElementById("clear-patches");
  const patchGroup = document.getElementById("patch-group");

  const langBtn = document.getElementById("lang-toggle");
  const audioBtn = document.getElementById("audio-toggle");
  const resetBtn = document.getElementById("reset-progress");

  function stagePolicy() {
    const id = state.stageIndex + 1;
    if (id === 1) {
      return { dialEnabled: false, patchEnabled: false, maxPatches: 0 };
    }
    if (id === 2) {
      return { dialEnabled: true, patchEnabled: false, maxPatches: 0 };
    }
    if (id === 3) {
      return { dialEnabled: true, patchEnabled: true, maxPatches: 1 };
    }
    return { dialEnabled: true, patchEnabled: true, maxPatches: null };
  }

  function applyStagePolicy() {
    const policy = stagePolicy();
    const reachedPatchLimit = policy.maxPatches !== null && state.controls.patches.length >= policy.maxPatches;

    dialGroup.classList.toggle("locked", !policy.dialEnabled);
    dialValue.disabled = !policy.dialEnabled;
    dialDown.disabled = !policy.dialEnabled;
    dialUp.disabled = !policy.dialEnabled;

    patchGroup.classList.toggle("locked", !policy.patchEnabled);
    patchFrom.disabled = !policy.patchEnabled || reachedPatchLimit;
    patchTo.disabled = !policy.patchEnabled || reachedPatchLimit;
    patchAdd.disabled = !policy.patchEnabled || reachedPatchLimit;
    patchClear.disabled = !policy.patchEnabled;
  }

  function syncControls() {
    powerSwitch.checked = state.controls.power;
    phaseSwitch.checked = state.controls.phase;
    freqKnob.value = String(state.controls.freq);
    fineKnob.value = String(state.controls.fine);
    gainKnob.value = String(state.controls.gain);
    freqValue.textContent = String(state.controls.freq);
    fineValue.textContent = String(state.controls.fine);
    gainValue.textContent = String(state.controls.gain);
    dialValue.value = String(state.controls.dial);
    renderPatches(patchList, state.controls.patches);
    highlightPorts(state.controls.patches);
    applyStagePolicy();
  }

  function attachNumberInput(input, key, labelEl) {
    input.addEventListener("input", () => {
      state.controls[key] = Number(input.value);
      labelEl.textContent = input.value;
      onChange();
    });
  }

  powerSwitch.addEventListener("change", () => {
    state.controls.power = powerSwitch.checked;
    onChange();
  });

  phaseSwitch.addEventListener("change", () => {
    state.controls.phase = phaseSwitch.checked;
    onChange();
  });

  attachNumberInput(freqKnob, "freq", freqValue);
  attachNumberInput(fineKnob, "fine", fineValue);
  attachNumberInput(gainKnob, "gain", gainValue);

  dialDown.addEventListener("click", () => {
    state.controls.dial = (state.controls.dial + 999) % 1000;
    dialValue.value = String(state.controls.dial);
    onChange();
  });

  dialUp.addEventListener("click", () => {
    state.controls.dial = (state.controls.dial + 1) % 1000;
    dialValue.value = String(state.controls.dial);
    onChange();
  });

  dialValue.addEventListener("input", () => {
    const value = Math.max(0, Math.min(999, Number(dialValue.value || 0)));
    state.controls.dial = Number.isNaN(value) ? 0 : Math.round(value);
    dialValue.value = String(state.controls.dial);
    onChange();
  });

  patchAdd.addEventListener("click", () => {
    const policy = stagePolicy();
    if (!policy.patchEnabled) {
      return;
    }

    if (policy.maxPatches !== null && state.controls.patches.length >= policy.maxPatches) {
      return;
    }

    const route = `${patchFrom.value}->${patchTo.value}`;
    onAddPatch(route);
    syncControls();
    onChange();
  });

  patchClear.addEventListener("click", () => {
    const policy = stagePolicy();
    if (!policy.patchEnabled) {
      return;
    }

    onClearPatches();
    syncControls();
    onChange();
  });

  langBtn.addEventListener("click", onToggleLang);
  audioBtn.addEventListener("click", onToggleAudio);
  resetBtn.addEventListener("click", onResetProgress);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      state.controls.freq = Math.min(100, state.controls.freq + 1);
      syncControls();
      onChange();
      return;
    }

    if (event.key === "ArrowDown") {
      state.controls.freq = Math.max(0, state.controls.freq - 1);
      syncControls();
      onChange();
    }
  });

  syncControls();

  return {
    syncControls,
    setAudioLabel(label) {
      audioBtn.textContent = label;
    },
    setLangButtonLabel(label) {
      langBtn.textContent = label;
    },
  };
}

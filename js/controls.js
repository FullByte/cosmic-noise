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

export function wireControls({ state, onChange, onAddPatch, onClearPatches, onSetLanguage, onToggleAudio, onResetProgress }) {
  const powerSwitch = document.getElementById("power-switch");
  const phaseSwitch = document.getElementById("phase-switch");
  const freqValue = document.getElementById("freq-value");
  const fineValue = document.getElementById("fine-value");
  const gainValue = document.getElementById("gain-value");
  const freqRotary = document.getElementById("freq-rotary");
  const fineRotary = document.getElementById("fine-rotary");
  const gainRotary = document.getElementById("gain-rotary");
  const freqRotaryIndicator = document.getElementById("freq-rotary-indicator");
  const fineRotaryIndicator = document.getElementById("fine-rotary-indicator");
  const gainRotaryIndicator = document.getElementById("gain-rotary-indicator");

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

  const langSelect = document.getElementById("lang-select");
  const audioBtn = document.getElementById("audio-toggle");
  const resetBtn = document.getElementById("reset-progress");

  const rotaryConfig = {
    freq: {
      key: "freq",
      root: freqRotary,
      indicator: freqRotaryIndicator,
      valueEl: freqValue,
      min: 0,
      max: 100,
      step: 1,
      label: "Frequency rotary control",
    },
    fine: {
      key: "fine",
      root: fineRotary,
      indicator: fineRotaryIndicator,
      valueEl: fineValue,
      min: -50,
      max: 50,
      step: 1,
      label: "Fine tune rotary control",
    },
    gain: {
      key: "gain",
      root: gainRotary,
      indicator: gainRotaryIndicator,
      valueEl: gainValue,
      min: 0,
      max: 100,
      step: 1,
      label: "Gain rotary control",
    },
  };

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
    updateRotaryVisual("freq");
    updateRotaryVisual("fine");
    updateRotaryVisual("gain");
    dialValue.value = String(state.controls.dial);
    renderPatches(patchList, state.controls.patches);
    highlightPorts(state.controls.patches);
    applyStagePolicy();
  }

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function valueToAngle(value, min, max) {
    const normalized = (value - min) / (max - min);
    return -140 + normalized * 280;
  }

  function pointerToValue(root, clientX, clientY, min, max) {
    const rect = root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    deg = Math.max(-140, Math.min(140, deg));

    const normalized = (deg + 140) / 280;
    return min + normalized * (max - min);
  }

  function updateRotaryVisual(controlKey) {
    const cfg = rotaryConfig[controlKey];
    if (!cfg) {
      return;
    }

    const raw = Number(state.controls[cfg.key]);
    const value = clampValue(Number.isNaN(raw) ? cfg.min : raw, cfg.min, cfg.max);
    state.controls[cfg.key] = value;
    if (cfg.valueEl) {
      cfg.valueEl.textContent = String(value);
    }
    if (cfg.root) {
      cfg.root.setAttribute("aria-valuenow", String(value));
    }
    if (cfg.indicator) {
      const angle = valueToAngle(value, cfg.min, cfg.max);
      cfg.indicator.style.transform = `translateX(-50%) rotate(${angle.toFixed(2)}deg)`;
    }
  }

  function setControlValue(controlKey, nextValue) {
    const cfg = rotaryConfig[controlKey];
    if (!cfg) {
      return;
    }

    const clamped = clampValue(nextValue, cfg.min, cfg.max);
    if (state.controls[cfg.key] === clamped) {
      return;
    }

    state.controls[cfg.key] = clamped;
    updateRotaryVisual(controlKey);
    onChange();
  }

  function setupRotary(controlKey) {
    const cfg = rotaryConfig[controlKey];
    if (!cfg || !cfg.root) {
      return;
    }

    const root = cfg.root;
    let dragging = false;

    root.setAttribute("role", "slider");
    root.setAttribute("tabindex", "0");
    root.setAttribute("aria-label", cfg.label);
    root.setAttribute("aria-valuemin", String(cfg.min));
    root.setAttribute("aria-valuemax", String(cfg.max));

    root.addEventListener("pointerdown", (event) => {
      dragging = true;
      root.setPointerCapture(event.pointerId);
      setControlValue(controlKey, pointerToValue(root, event.clientX, event.clientY, cfg.min, cfg.max));
    });

    root.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setControlValue(controlKey, pointerToValue(root, event.clientX, event.clientY, cfg.min, cfg.max));
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }
    };

    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    root.addEventListener("wheel", (event) => {
      event.preventDefault();
      const dir = event.deltaY > 0 ? -1 : 1;
      setControlValue(controlKey, state.controls[cfg.key] + dir * cfg.step);
    }, { passive: false });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        setControlValue(controlKey, state.controls[cfg.key] + cfg.step);
        event.preventDefault();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        setControlValue(controlKey, state.controls[cfg.key] - cfg.step);
        event.preventDefault();
      }
      if (event.key === "Home") {
        setControlValue(controlKey, cfg.min);
        event.preventDefault();
      }
      if (event.key === "End") {
        setControlValue(controlKey, cfg.max);
        event.preventDefault();
      }
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

  setupRotary("freq");
  setupRotary("fine");
  setupRotary("gain");

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

  langSelect?.addEventListener("change", () => {
    onSetLanguage(langSelect.value);
  });
  audioBtn.addEventListener("click", onToggleAudio);
  resetBtn.addEventListener("click", onResetProgress);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      setControlValue("freq", state.controls.freq + 1);
      return;
    }

    if (event.key === "ArrowDown") {
      setControlValue("freq", state.controls.freq - 1);
    }
  });

  syncControls();

  return {
    syncControls,
    setAudioLabel(label) {
      audioBtn.textContent = label;
    },
    setLanguageValue(value) {
      if (langSelect) {
        langSelect.value = value;
      }
    },
  };
}

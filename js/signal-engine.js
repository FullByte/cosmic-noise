function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export const COMPLETION_CLARITY = 88;
export const COMPLETION_CONFIDENCE = 84;

function closeness(value, target, tolerance) {
  const delta = Math.abs(value - target);
  return clamp01(1 - delta / tolerance);
}

function routeMatches(current, expected) {
  const currentSet = new Set(current);
  const expectedSet = new Set(expected);
  let exact = 0;
  for (const route of currentSet) {
    if (expectedSet.has(route)) {
      exact += 1;
    }
  }
  const coverage = expectedSet.size === 0 ? 1 : exact / expectedSet.size;
  const noisePenalty = currentSet.size > expectedSet.size ? (currentSet.size - expectedSet.size) * 0.07 : 0;
  return clamp01(coverage - noisePenalty);
}

export function evaluateSignal(stage, controls, language, textLookup) {
  const target = stage.target;
  const tol = stage.tolerance;

  const powerScore = controls.power === target.power ? 1 : 0;
  const phaseScore = controls.phase === target.phase ? 1 : 0;
  const freqScore = closeness(controls.freq, target.freq, tol.freq);
  const fineScore = closeness(controls.fine, target.fine, tol.fine);
  const gainScore = closeness(controls.gain, target.gain, tol.gain);
  const dialScore = closeness(controls.dial, target.dial, tol.dial);
  const routeScore = routeMatches(controls.patches, target.routes);

  const weighted =
    powerScore * 0.16 +
    phaseScore * 0.08 +
    freqScore * 0.2 +
    fineScore * 0.16 +
    gainScore * 0.16 +
    dialScore * 0.14 +
    routeScore * 0.1;

  const clarity = Math.round(clamp01(weighted) * 100);
  const confidence = Math.round(clamp01(weighted * 0.88 + routeScore * 0.12) * 100);

  const hints = buildHints(
    {
    powerScore,
    phaseScore,
    freqScore,
    fineScore,
    gainScore,
    dialScore,
    routeScore,
    },
    textLookup
  );

  const outputText = stage.message[language] || stage.message.en;
  const decoded = scrambleMessage(outputText, clarity);
  const completed = clarity >= COMPLETION_CLARITY && confidence >= COMPLETION_CONFIDENCE;

  if (!controls.power) {
    hints.unshift(textLookup("hintPowerOff"));
  } else if (clarity < 45) {
    hints.unshift(textLookup("hintFar"));
  } else if (clarity < 75) {
    hints.unshift(textLookup("hintClose"));
  } else {
    hints.unshift(textLookup("hintPowerOn"));
  }

  return { clarity, confidence, hints, decoded, completed };
}

function buildHints(scores, textLookup) {
  const details = [];
  details.push(scoreLine(textLookup("channelPower"), scores.powerScore, textLookup));
  details.push(scoreLine(textLookup("channelPhase"), scores.phaseScore, textLookup));
  details.push(scoreLine(textLookup("channelFrequency"), scores.freqScore, textLookup));
  details.push(scoreLine(textLookup("channelFine"), scores.fineScore, textLookup));
  details.push(scoreLine(textLookup("channelGain"), scores.gainScore, textLookup));
  details.push(scoreLine(textLookup("channelDial"), scores.dialScore, textLookup));
  details.push(scoreLine(textLookup("channelRouting"), scores.routeScore, textLookup));
  return details;
}

function scoreLine(label, score, textLookup) {
  if (score >= 0.96) {
    return `${label}: ${textLookup("scoreExact")}`;
  }
  if (score >= 0.7) {
    return `${label}: ${textLookup("scoreNear")}`;
  }
  if (score >= 0.35) {
    return `${label}: ${textLookup("scoreNoisy")}`;
  }
  return `${label}: ${textLookup("scoreMismatch")}`;
}

function scrambleMessage(message, clarity) {
  const revealChance = clarity / 100;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let output = "";

  for (const char of message) {
    if (char === " " || char === "." || char === "," || char === "-") {
      output += char;
      continue;
    }

    if (Math.random() < revealChance) {
      output += char;
      continue;
    }

    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

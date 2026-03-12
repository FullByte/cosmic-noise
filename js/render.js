export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let tick = 0;

  function draw({ clarity, confidence, controls, stage }) {
    tick += 1;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#020605";
    ctx.fillRect(0, 0, width, height);

    drawScanlines(ctx, width, height, clarity);
    drawNoiseWave(ctx, width, height, clarity, confidence, controls, tick);
    drawCenterText(ctx, width, height, stage, clarity);
  }

  return { draw };
}

function drawScanlines(ctx, width, height, clarity) {
  ctx.save();
  ctx.globalAlpha = 0.15 + (100 - clarity) / 100 * 0.22;
  ctx.strokeStyle = "#17382f";
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNoiseWave(ctx, width, height, clarity, confidence, controls, tick) {
  const quality = clarity / 100;
  const baseAmplitude = (1 - quality) * 82 + 8;
  const center = height / 2;
  const phaseShift = controls.phase ? Math.PI : 0;
  const freq = 0.006 + controls.freq / 100 * 0.025;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(124, 255, 208, ${0.35 + confidence / 100 * 0.6})`;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(124,255,208,0.5)";

  ctx.beginPath();
  for (let x = 0; x < width; x += 2) {
    const noise = (Math.random() - 0.5) * baseAmplitude;
    const harmonic = Math.sin(x * freq + tick * 0.08 + phaseShift) * (controls.gain / 100) * 40;
    const fine = Math.sin(x * 0.02 + tick * 0.03) * controls.fine;
    const y = center + noise + harmonic + fine;

    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.restore();
}

function drawCenterText(ctx, width, height, stage, clarity) {
  const alpha = 0.08 + clarity / 100 * 0.45;
  ctx.save();
  ctx.fillStyle = `rgba(246, 184, 74, ${alpha})`;
  ctx.font = "700 40px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`STAGE ${stage.id}`, width / 2, height / 2 - 10);
  ctx.font = "600 16px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillText("CARRIER DECODE IN PROGRESS", width / 2, height / 2 + 22);
  ctx.restore();
}

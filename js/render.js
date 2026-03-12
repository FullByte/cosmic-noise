const THREE_MODULE_URL = "https://unpkg.com/three@0.162.0/build/three.module.js";
let threeModulePromise = null;

function loadThreeModule() {
  if (!threeModulePromise) {
    threeModulePromise = import(THREE_MODULE_URL);
  }
  return threeModulePromise;
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uClarity;
uniform float uConfidence;
uniform float uPower;
uniform float uPhase;
uniform float uFreq;
uniform float uFine;
uniform float uGain;
uniform float uDial;
uniform float uPatchCount;
uniform float uStage;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

float linePulse(float y, float t) {
  float band = smoothstep(0.98, 1.0, sin(y * 820.0 + t * 2.8));
  float drift = smoothstep(0.96, 1.0, sin(y * 420.0 - t * 1.9));
  return max(band, drift);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;

  float quality = clamp(uClarity, 0.0, 1.0);
  float trust = clamp(uConfidence, 0.0, 1.0);

  float freqBias = abs(uFreq - 0.5) * 2.0;
  float fineBias = abs(uFine - 0.5) * 2.0;
  float gainBoost = pow(uGain, 1.15);
  float patchChaos = clamp(uPatchCount / 6.0, 0.0, 1.0);
  float dialChaos = abs(sin(uDial * 60.0));

  float dirt = (1.0 - quality) * 0.7 + gainBoost * 0.22 + freqBias * 0.08 + fineBias * 0.06;
  dirt += patchChaos * 0.08 + dialChaos * 0.04;
  dirt = clamp(dirt, 0.0, 1.0);

  float horizontalWarp = (noise(vec2(t * 3.2, uv.y * 45.0 + uStage * 0.2)) - 0.5) * (0.09 + dirt * 0.18);
  uv.x += horizontalWarp;

  float snowA = hash(vec2(floor(uv.x * uResolution.x * (0.7 + dirt * 0.8)), floor(uv.y * uResolution.y * (0.9 + dirt * 0.9)) + floor(t * 80.0)));
  float snowB = noise(vec2(uv.x * 540.0 + t * 15.0, uv.y * 330.0 - t * 11.0));
  float tvSnow = mix(snowA, snowB, 0.45);

  float grain = noise(vec2(uv.x * 260.0 + t * 2.2, uv.y * 160.0 - t * 1.7));
  float scan = 0.78 + 0.22 * sin((uv.y + t * 0.01) * uResolution.y * 0.72);
  float tearing = linePulse(uv.y, t) * (0.04 + dirt * 0.18);

  float signalFreq = 18.0 + uFreq * 58.0;
  float phase = uPhase > 0.5 ? 3.14159265 : 0.0;
  float center = 0.5 + sin(uv.x * signalFreq + t * (1.4 + uFine * 2.2) + phase) * (0.015 + (1.0 - dirt) * 0.035);
  center += sin(uv.x * (signalFreq * 0.35) - t * 0.8) * (uFine - 0.5) * 0.06;

  float band = abs(uv.y - center);
  float carrier = smoothstep(0.045 + dirt * 0.02, 0.0, band);

  vec3 bg = vec3(0.01, 0.018, 0.016);
  vec3 snowColor = vec3(tvSnow * (0.3 + dirt * 0.9));
  vec3 phosphor = vec3(0.20, 0.95, 0.72) * carrier * (0.32 + trust * 0.85);
  vec3 amberTag = vec3(0.95, 0.72, 0.28) * smoothstep(0.18, 0.0, length(uv - vec2(0.5, 0.5))) * (0.04 + quality * 0.18);

  vec3 color = bg;
  color += snowColor * (0.45 + dirt * 0.65) * scan;
  color += phosphor;
  color += amberTag;
  color += (grain - 0.5) * 0.09;
  color += tearing;

  if (uPower < 0.5) {
    float deadNoise = hash(vec2(floor(vUv.x * uResolution.x), floor(vUv.y * uResolution.y) + floor(t * 100.0)));
    color = vec3(deadNoise * 0.18);
    color += vec3(0.02, 0.03, 0.025) * linePulse(vUv.y, t);
  }

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function resizeRenderer(canvas, renderer) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
  }

  return { width, height };
}

function drawFallback2d(ctx, canvas, frame, clarity, confidence, controls, stage) {
  const width = canvas.width;
  const height = canvas.height;
  const quality = clamp01(clarity / 100);
  const trust = clamp01(confidence / 100);
  const freqBias = Math.abs(controls.freq / 100 - 0.5) * 2;
  const fineBias = Math.abs((controls.fine + 50) / 100 - 0.5) * 2;
  const gain = clamp01(controls.gain / 100);
  const patchChaos = Math.min((controls.patches?.length || 0) / 6, 1);
  const dirt = clamp01((1 - quality) * 0.7 + gain * 0.2 + freqBias * 0.07 + fineBias * 0.06 + patchChaos * 0.08);

  ctx.fillStyle = "#020605";
  ctx.fillRect(0, 0, width, height);

  const img = ctx.createImageData(width, height);
  const pixels = img.data;
  const time = frame * 0.016;
  const powerOn = controls.power;

  for (let y = 0; y < height; y++) {
    const scan = 0.82 + 0.18 * Math.sin(y * 0.6 + time * 4);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const jitter = Math.sin(y * 0.12 + time * 8 + stage.id * 0.31) * (8 + dirt * 26);
      const sx = Math.max(0, Math.min(width - 1, x + jitter));
      const snow = (Math.sin(sx * 12.9898 + y * 78.233 + time * 190) * 43758.5453) % 1;
      const tv = Math.abs(snow);
      const grain = (Math.sin(sx * 0.35 + y * 0.77 + time * 13.2) + 1) * 0.5;

      const carrierCenter =
        height * (0.5 +
          Math.sin((x / width) * (16 + controls.freq * 0.6) + time * (1.2 + controls.fine * 0.03) + (controls.phase ? Math.PI : 0)) *
            (0.02 + (1 - dirt) * 0.03));
      const dist = Math.abs(y - carrierCenter) / height;
      const carrier = Math.max(0, 1 - dist / (0.03 + dirt * 0.015));

      let base = tv * (0.3 + dirt * 0.95) * scan + (grain - 0.5) * 0.18;
      base += carrier * (0.2 + trust * 0.8);

      if (!powerOn) {
        base = tv * 0.2 + Math.max(0, Math.sin(y * 0.35 + time * 5)) * 0.06;
      }

      const r = Math.min(255, Math.max(0, (base * 120 + carrier * 28) * 1.02));
      const g = Math.min(255, Math.max(0, base * 190 + carrier * 110));
      const b = Math.min(255, Math.max(0, base * 160 + carrier * 72));

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}

function buildThreeRenderer(canvas, THREE) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
    uClarity: { value: 0 },
    uConfidence: { value: 0 },
    uPower: { value: 0 },
    uPhase: { value: 0 },
    uFreq: { value: 0.5 },
    uFine: { value: 0.5 },
    uGain: { value: 0.4 },
    uDial: { value: 0 },
    uPatchCount: { value: 0 },
    uStage: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  return { renderer, scene, camera, uniforms };
}

export function createRenderer(canvas) {
  const ctx2d = canvas.getContext("2d");
  let frame = 0;
  let threeReady = null;
  let loadingStarted = false;
  let loadingFailed = false;

  function ensureThree() {
    if (loadingStarted || loadingFailed) {
      return;
    }

    loadingStarted = true;
    loadThreeModule()
      .then((THREE) => {
        threeReady = buildThreeRenderer(canvas, THREE);
      })
      .catch(() => {
        loadingFailed = true;
      });
  }

  function draw({ clarity, confidence, controls, stage }) {
    frame += 1;
    ensureThree();

    if (!threeReady || loadingFailed) {
      drawFallback2d(ctx2d, canvas, frame, clarity, confidence, controls, stage);
      return;
    }

    const { renderer, scene, camera, uniforms } = threeReady;
    const size = resizeRenderer(canvas, renderer);
    uniforms.uResolution.value.set(size.width, size.height);
    uniforms.uTime.value += 0.016;

    uniforms.uClarity.value = clamp01(clarity / 100);
    uniforms.uConfidence.value = clamp01(confidence / 100);
    uniforms.uPower.value = controls.power ? 1 : 0;
    uniforms.uPhase.value = controls.phase ? 1 : 0;
    uniforms.uFreq.value = clamp01(controls.freq / 100);
    uniforms.uFine.value = clamp01((controls.fine + 50) / 100);
    uniforms.uGain.value = clamp01(controls.gain / 100);
    uniforms.uDial.value = clamp01(controls.dial / 999);
    uniforms.uPatchCount.value = Array.isArray(controls.patches) ? controls.patches.length : 0;
    uniforms.uStage.value = stage.id;

    renderer.render(scene, camera);
  }

  return { draw };
}

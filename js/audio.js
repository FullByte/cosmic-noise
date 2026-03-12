let audioContext;
let noiseSource;
let noiseGain;
let filter;
let started = false;

function createNoiseNode(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

export async function ensureAudioStarted() {
  if (!audioContext) {
    audioContext = new AudioContext();
    noiseGain = audioContext.createGain();
    filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 4;

    noiseSource = createNoiseNode(audioContext);
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noiseGain.gain.value = 0;
    noiseSource.start();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  started = true;
}

export function updateAudio({ enabled, clarity, controls }) {
  if (!audioContext || !started) {
    return;
  }

  const targetGain = enabled ? 0.02 + (1 - clarity / 100) * 0.08 : 0;
  noiseGain.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.06);

  const frequency = 180 + controls.freq * 18 + controls.fine * 2;
  filter.frequency.setTargetAtTime(Math.max(80, Math.min(2400, frequency)), audioContext.currentTime, 0.08);
  filter.Q.setTargetAtTime(2 + controls.gain / 20, audioContext.currentTime, 0.08);
}

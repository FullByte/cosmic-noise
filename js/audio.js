let audioContext;
let noiseSource;
let noiseGain;
let filter;
let songGain;
let masterGain;
let songElements = [];
let songSources = [];
let activeSongIndex = -1;
let lastEnabled = false;
let lastStageIndex = -1;
let started = false;

const SONG_COUNT = 5;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

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

function createSongElements() {
  return Array.from({ length: SONG_COUNT }, (_, idx) => {
    const song = new Audio(new URL(`../audio/song${idx + 1}.mp3`, import.meta.url).href);
    song.loop = true;
    song.preload = "auto";
    return song;
  });
}

function pauseAllSongs() {
  for (const song of songElements) {
    song.pause();
  }
}

function stageToSongIndex(stageIndex) {
  return Math.max(0, Math.min(SONG_COUNT - 1, stageIndex || 0));
}

async function playSong(index) {
  const song = songElements[index];
  if (!song) {
    return;
  }

  try {
    await song.play();
  } catch {
    // Browsers may reject playback until a gesture; next user-triggered audio toggle retries.
  }
}

function switchSong(stageIndex, enabled) {
  const nextSongIndex = stageToSongIndex(stageIndex);
  if (nextSongIndex === activeSongIndex && enabled) {
    return;
  }

  if (activeSongIndex >= 0 && songElements[activeSongIndex]) {
    songElements[activeSongIndex].pause();
    songElements[activeSongIndex].currentTime = 0;
  }

  activeSongIndex = nextSongIndex;
  const nextSong = songElements[activeSongIndex];
  if (!nextSong) {
    return;
  }

  nextSong.currentTime = 0;
  if (enabled) {
    void playSong(activeSongIndex);
  }
}

export async function ensureAudioStarted() {
  if (!audioContext) {
    audioContext = new AudioContext();

    masterGain = audioContext.createGain();
    noiseGain = audioContext.createGain();
    songGain = audioContext.createGain();
    filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 4;

    masterGain.gain.value = 0.9;

    noiseSource = createNoiseNode(audioContext);
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    songElements = createSongElements();
    songSources = songElements.map((song) => {
      const source = audioContext.createMediaElementSource(song);
      source.connect(songGain);
      return source;
    });

    songGain.connect(masterGain);
    masterGain.connect(audioContext.destination);

    noiseGain.gain.value = 0;
    songGain.gain.value = 0;
    noiseSource.start();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  started = true;
}

export function updateAudio({ enabled, confidence, stageIndex }) {
  if (!audioContext || !started) {
    return;
  }

  const confidenceRatio = clamp01((confidence || 0) / 100);
  const targetSongGain = enabled ? confidenceRatio : 0;
  const targetNoiseGain = enabled ? 1 - confidenceRatio : 0;

  if (enabled && (!lastEnabled || lastStageIndex !== stageIndex)) {
    switchSong(stageIndex, true);
  }

  if (!enabled && lastEnabled) {
    pauseAllSongs();
  }

  if (enabled && activeSongIndex >= 0 && songElements[activeSongIndex]?.paused) {
    void playSong(activeSongIndex);
  }

  noiseGain.gain.setTargetAtTime(targetNoiseGain, audioContext.currentTime, 0.08);
  songGain.gain.setTargetAtTime(targetSongGain, audioContext.currentTime, 0.08);

  const frequency = 520 + targetNoiseGain * 980;
  filter.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.08);
  filter.Q.setTargetAtTime(1.4 + targetNoiseGain * 5.2, audioContext.currentTime, 0.08);

  lastEnabled = enabled;
  lastStageIndex = stageIndex;
}

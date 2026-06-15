'use strict';

const overlay         = document.getElementById('overlay');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayError    = document.getElementById('overlay-error');
const statusEl        = document.getElementById('status');
const modeIndicator   = document.getElementById('mode-indicator');
const modeLabel       = document.getElementById('mode-label');
const debugMeter      = document.getElementById('debug-meter');
const debugBar        = document.getElementById('debug-bar');
const debugValue      = document.getElementById('debug-value');
const debugState      = document.getElementById('debug-state');

let micStream = null, audioCtx = null, analyser = null, sourceNode = null, timeDomain = null;

let isCalibrating = false, calibrationStart = 0;
const CALIBRATION_MS = 3000;
let calibrationSamples = [], noiseFloor = 0;

const ONSET_MULTIPLIER = 2.5, RELEASE_MULTIPLIER = 1.5;
let breathState = 'idle', onsetThreshold = 0, releaseThreshold = 0;
let breathStartTime = 0, breathDuration = 0, breathPeakRMS = 0, currentRMS = 0;

let toneStarted = false, piano = null, reverb = null, pianoReady = false;

let isInhaleMode = true;

const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
const PIANO_SAMPLES = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
};
const sampleUrls = {};
for (const [note, file] of Object.entries(PIANO_SAMPLES)) {
  sampleUrls[note] = SAMPLE_BASE + file;
}

const SCALES = {
  inhale: { label: 'Inhale · Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  exhale: { label: 'Exhale · Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildScaleNotes(intervals) {
  const notes = [];
  for (let octave = 1; octave <= 7; octave++) {
    for (const interval of intervals) {
      if (interval < NOTE_NAMES.length) notes.push(NOTE_NAMES[interval] + octave);
    }
  }
  return notes;
}

const INHALE_NOTES = buildScaleNotes(SCALES.inhale.intervals);
const EXHALE_NOTES = buildScaleNotes(SCALES.exhale.intervals);

const MIN_DURATION = 150, MAX_DURATION = 4000;

function durationToNote(durationMs) {
  const notePool = isInhaleMode ? INHALE_NOTES : EXHALE_NOTES;
  const d = Math.max(MIN_DURATION, Math.min(durationMs, MAX_DURATION));
  const t = (d - MIN_DURATION) / (MAX_DURATION - MIN_DURATION);
  const noteIndex = Math.round((1 - t) * (notePool.length - 1));
  return notePool[noteIndex];
}

function calcRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const s = (buffer[i] - 128) / 128;
    sum += s * s;
  }
  return Math.sqrt(sum / buffer.length);
}

function showStatus(text) { statusEl.textContent = text; statusEl.classList.add('visible'); }
function hideStatus() { statusEl.classList.remove('visible'); }

function loadPiano() {
  return new Promise((resolve) => {
    reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).toDestination();
    piano = new Tone.Sampler({
      urls: sampleUrls, release: 2,
      onload: () => { piano.connect(reverb); pianoReady = true; resolve(); },
    });
  });
}

function playNote(note, velocity) {
  if (!pianoReady || !piano) return;
  piano.triggerAttackRelease(note, '2n', Tone.now(), velocity);
  console.log(`🎹 Playing ${note} vel=${velocity.toFixed(2)}`);
}

function startCalibration() {
  isCalibrating = true; calibrationStart = performance.now();
  calibrationSamples = []; showStatus('Calibrating… stay quiet');
}
function finishCalibration() {
  isCalibrating = false;
  noiseFloor = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
  onsetThreshold = noiseFloor * ONSET_MULTIPLIER;
  releaseThreshold = noiseFloor * RELEASE_MULTIPLIER;
  hideStatus();
}

function detectBreath() {
  if (isCalibrating || noiseFloor === 0) return;
  if (breathState === 'idle' && currentRMS > onsetThreshold) {
    breathState = 'breathing'; breathStartTime = performance.now(); breathPeakRMS = currentRMS;
  } else if (breathState === 'breathing') {
    if (currentRMS > breathPeakRMS) breathPeakRMS = currentRMS;
    if (currentRMS < releaseThreshold) {
      breathDuration = performance.now() - breathStartTime;
      breathState = 'idle';
      onBreathEnd(breathDuration, breathPeakRMS);
    }
  }
}

function onBreathEnd(durationMs, peakRMS) {
  if (durationMs < MIN_DURATION) return;

  const note = durationToNote(durationMs);

  const normalizedPeak = Math.min((peakRMS - noiseFloor) / (noiseFloor * 10), 1);
  const velocity = 0.1 + normalizedPeak * 0.9;

  playNote(note, velocity);
}

function monitorLoop() {
  requestAnimationFrame(monitorLoop);
  if (!analyser) return;
  analyser.getByteTimeDomainData(timeDomain);
  currentRMS = calcRMS(timeDomain);

  if (isCalibrating) {
    calibrationSamples.push(currentRMS);
    const elapsed = performance.now() - calibrationStart;
    const remaining = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
    showStatus(`Calibrating… stay quiet (${remaining}s)`);
    if (elapsed >= CALIBRATION_MS) finishCalibration();
  }

  detectBreath();
  const pct = Math.min(currentRMS * 500, 100);
  debugBar.style.width = pct + '%';
  debugValue.textContent = currentRMS.toFixed(4);
  debugState.textContent = breathState;
}

function toggleMode() {
  isInhaleMode = !isInhaleMode;
  modeLabel.textContent = isInhaleMode ? SCALES.inhale.label : SCALES.exhale.label;
}
modeIndicator.addEventListener('click', toggleMode);

document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') toggleMode();
  if (e.key === 'd' || e.key === 'D') debugMeter.classList.toggle('visible');
});

overlay.addEventListener('click', async () => {
  try {
    overlaySubtitle.textContent = 'Loading piano…';
    overlaySubtitle.style.animation = 'none';

    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    sourceNode = audioCtx.createMediaStreamSource(micStream);
    sourceNode.connect(analyser);
    timeDomain = new Uint8Array(analyser.fftSize);

    await Tone.start();
    toneStarted = true;
    await loadPiano();

    overlay.classList.add('hidden');
    startCalibration();
    monitorLoop();
  } catch (err) {
    console.error('Startup error:', err);
    overlayError.textContent = 'Microphone access is required. Please allow and try again.';
    overlayError.classList.add('visible');
    overlaySubtitle.textContent = 'Click anywhere to begin';
    overlaySubtitle.style.animation = '';
  }
});

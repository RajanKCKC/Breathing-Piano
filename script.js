'use strict';

const overlay         = document.getElementById('overlay');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayError    = document.getElementById('overlay-error');
const statusEl        = document.getElementById('status');
const debugMeter      = document.getElementById('debug-meter');
const debugBar        = document.getElementById('debug-bar');
const debugValue      = document.getElementById('debug-value');
const debugState      = document.getElementById('debug-state');

let micStream   = null;
let audioCtx    = null;
let analyser    = null;
let sourceNode  = null;
let timeDomain  = null;

let isCalibrating    = false;
let calibrationStart = 0;
const CALIBRATION_MS = 3000;
let calibrationSamples = [];
let noiseFloor = 0;

const ONSET_MULTIPLIER  = 2.5;
const RELEASE_MULTIPLIER = 1.5;
let breathState = 'idle';
let onsetThreshold  = 0;
let releaseThreshold = 0;
let breathStartTime = 0;
let breathDuration  = 0;
let breathPeakRMS   = 0;
let currentRMS = 0;

let toneStarted = false;
let piano       = null;
let reverb      = null;
let pianoReady  = false;

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

function calcRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = (buffer[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.add('visible');
}

function hideStatus() {
  statusEl.classList.remove('visible');
}

function loadPiano() {
  return new Promise((resolve) => {
    reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).toDestination();

    piano = new Tone.Sampler({
      urls: sampleUrls,
      release: 2,
      onload: () => {
        piano.connect(reverb);
        pianoReady = true;
        console.log('Piano sampler loaded ✓');
        resolve();
      },
    });
  });
}

function startCalibration() {
  isCalibrating = true;
  calibrationStart = performance.now();
  calibrationSamples = [];
  showStatus('Calibrating… stay quiet');
}

function finishCalibration() {
  isCalibrating = false;
  const sum = calibrationSamples.reduce((a, b) => a + b, 0);
  noiseFloor = sum / calibrationSamples.length;
  onsetThreshold   = noiseFloor * ONSET_MULTIPLIER;
  releaseThreshold = noiseFloor * RELEASE_MULTIPLIER;
  console.log(`Noise floor: ${noiseFloor.toFixed(5)}`);
  hideStatus();
}

function detectBreath() {
  if (isCalibrating || noiseFloor === 0) return;

  if (breathState === 'idle' && currentRMS > onsetThreshold) {
    breathState     = 'breathing';
    breathStartTime = performance.now();
    breathPeakRMS   = currentRMS;
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
  console.log(`Breath: ${durationMs.toFixed(0)}ms, Peak: ${peakRMS.toFixed(4)}`);
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

// Debug toggle
document.addEventListener('keydown', (e) => {
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

    console.log('Full audio pipeline ready ✓');
  } catch (err) {
    console.error('Startup error:', err);
    overlayError.textContent = 'Microphone access is required. Please allow and try again.';
    overlayError.classList.add('visible');
    overlaySubtitle.textContent = 'Click anywhere to begin';
    overlaySubtitle.style.animation = '';
  }
});

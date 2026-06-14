'use strict';

const overlay      = document.getElementById('overlay');
const overlayError = document.getElementById('overlay-error');
const statusEl     = document.getElementById('status');
const debugMeter   = document.getElementById('debug-meter');
const debugBar     = document.getElementById('debug-bar');
const debugValue   = document.getElementById('debug-value');
const debugState   = document.getElementById('debug-state');

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

let currentRMS = 0;

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

  console.log(`Noise floor: ${noiseFloor.toFixed(5)} | Onset: ${onsetThreshold.toFixed(5)} | Release: ${releaseThreshold.toFixed(5)}`);
  hideStatus();
}

function detectBreath() {
  if (isCalibrating || noiseFloor === 0) return;

  if (breathState === 'idle' && currentRMS > onsetThreshold) {
    // Breath started
    breathState = 'breathing';
    console.log('🌬️ Breath onset');
  } else if (breathState === 'breathing' && currentRMS < releaseThreshold) {
    // Breath ended
    breathState = 'idle';
    console.log('✋ Breath release');
  }
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    debugMeter.classList.toggle('visible');
  }
});

overlay.addEventListener('click', async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    sourceNode = audioCtx.createMediaStreamSource(micStream);
    sourceNode.connect(analyser);

    timeDomain = new Uint8Array(analyser.fftSize);

    overlay.classList.add('hidden');
    startCalibration();
    monitorLoop();

    console.log('Audio pipeline ready ✓');
  } catch (err) {
    console.error('Microphone access denied:', err);
    overlayError.textContent = 'Microphone access is required. Please allow and try again.';
    overlayError.classList.add('visible');
  }
});

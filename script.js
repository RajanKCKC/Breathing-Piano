'use strict';

const overlay      = document.getElementById('overlay');
const overlayError = document.getElementById('overlay-error');
const debugMeter   = document.getElementById('debug-meter');
const debugBar     = document.getElementById('debug-bar');
const debugValue   = document.getElementById('debug-value');

let micStream   = null;
let audioCtx    = null;
let analyser    = null;
let sourceNode  = null;
let timeDomain  = null;


let currentRMS = 0;

function calcRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = (buffer[i] - 128) / 128;   // normalise 0–255 → -1…1
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

function monitorLoop() {
  requestAnimationFrame(monitorLoop);
  if (!analyser) return;

  analyser.getByteTimeDomainData(timeDomain);
  currentRMS = calcRMS(timeDomain);

  // Update debug meter
  const pct = Math.min(currentRMS * 500, 100);   // scale for visibility
  debugBar.style.width = pct + '%';
  debugValue.textContent = currentRMS.toFixed(4);
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

    monitorLoop();

    console.log('Audio pipeline ready ✓');
  } catch (err) {
    console.error('Microphone access denied:', err);
    overlayError.textContent = 'Microphone access is required. Please allow and try again.';
    overlayError.classList.add('visible');
  }
});

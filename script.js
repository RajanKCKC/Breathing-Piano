'use strict';

const overlay      = document.getElementById('overlay');
const overlayError = document.getElementById('overlay-error');

let micStream   = null;
let audioCtx    = null;
let analyser    = null;
let sourceNode  = null;

overlay.addEventListener('click', async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    sourceNode = audioCtx.createMediaStreamSource(micStream);
    sourceNode.connect(analyser);

    overlay.classList.add('hidden');

    console.log('Audio pipeline ready ✓');
  } catch (err) {
    console.error('Microphone access denied:', err);
    overlayError.textContent = 'Microphone access is required. Please allow and try again.';
    overlayError.classList.add('visible');
  }
});

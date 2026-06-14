'use strict';

const overlay = document.getElementById('overlay');
const overlay = document.getElementById('overlay-error');

let micStream = null;
overlay.addEventListener('click', async () => {
    try{
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true});
        overlay.classList.add('hidden');
    } catch (err) {
        console.error('Microphone access denied:', err);
        overlayError.textContent = 'Microphone access is required. Please allow and try again.';
        overlayError.classList.add('visible');
    }
});

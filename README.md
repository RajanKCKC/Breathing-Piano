# Breathing Piano

An interactive web instrument that literally turns your breath into ambient piano music using your microphone.

---

### ⚡ Quick Start

1. Open the **[Live Demo](https://rajankckc.github.io/Breathing-Piano)**.
2. Click anywhere on the screen and hit "Allow" when it asks for microphone access (promise it’s not spying on you, it just needs to hear you breathe lol).
3. Sit back and take a deep breath in and out. The piano will automatically play notes based on how long and deep your breaths are!

---

### Features

* **Breath-to-Music Pipeline:** Uses your microphone to calculate real-time audio input, perfectly mapping the duration and intensity of your breath into piano chords.
* **Dynamic Musical Scales:** Easily switch between **Inhale Mode** (bright, uplifting Major scale vibes) and **Exhale Mode** (chill, meditative Minor scale vibes) by clicking the screen indicator or hitting the `M` key.
* **Aesthetic Visuals:** The entire interface shifts color dynamically depending on the piano octave being triggered, creating an immersive audio-visual feedback loop.
* **Interactive Mood Themes:** Features 4 beautiful built-in color palettes (*Mystic Purple*, *Forest Healing*, *Ocean Deep*, and *Ebony & Ivory*) toggled effortlessly by clicking the theme button or pressing `T`.
* **Secret Nerd Mode:** Hit `D` on your keyboard to reveal a live diagnostic bar showing your exact microphone volume (RMS) and internal state tracking.

---

### How to Run it Locally

If you want to tweak the code or host it yourself, it's super simple. There is no heavy backend or complicated build process—just clean, modern vanilla JavaScript.

#### Prerequisites
* **Node.js** or any simple local HTTP server.
* A modern browser with microphone permissions allowed on `localhost`.

#### Setup Instructions

1. Clone or download this repository containing `index.html`, `script.js`, and `style.css` to your machine.
2. Open your terminal in the project folder and spin up a quick server using your favorite tool:

```bash
# If you like npx / Node:
npx serve .

# Or if you are a Python fan:
python3 -m http.server 8000

```

3. Open the local URL provided by your terminal (e.g., `http://localhost:3000`) and start playing!

---

### How it Works

> **The Technical Breakdown:**
> Instead of burning cloud budget or overcomplicating things with heavy machine learning voice models, everything runs locally on the client-side via the Web Audio API inside `script.js`.
> 
> 
> When you first click the screen, the app runs a 3-second silence calibration to calculate your room's baseline background noise. It uses an `AnalyserNode` to sample byte time-domain data, running a continuous Root Mean Square (RMS) calculation to track volume spikes. Crossing a specific multiplier threshold flags a "breathing" state and kicks off a timer. When the volume dips back below the release threshold, the total duration is mapped linearly to an array of high-quality audio samples powered by `Tone.js`. We also routed the master track through a custom `Tone.Reverb` node with a 4-second decay, because dry piano notes just didn't pass the vibe check for a meditative experience. The gorgeous layout is styled entirely by `style.css` and rendered via `index.html`.
> 
> 

---

### Credits & Acknowledgements

* **Tone.js** for making the Web Audio API actually fun to work with.


* **Salamander Piano** for providing the clean, gorgeous audio sample banks.


* Google Fonts for the sleek typography.

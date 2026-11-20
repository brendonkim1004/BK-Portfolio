// All the site's sound. Nothing is downloaded: every sound is made on the spot with the
// browser's built-in synthesiser (Web Audio), so there are no audio files and no network calls.
//
// Sound is off until the visitor turns it on. Browsers also refuse to play anything before the
// first click or key press, so the audio engine is only started from the toggle (or, when a
// returning visitor left sound on, from their first click or key press).
const STORAGE_KEY = 'sound';

export function createSound() {
  let context = null;
  let master = null;
  let noise = null; // one second of hiss, reused for every whoosh and click
  let enabled = false;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    // Private browsing can block storage; sound just starts off.
  }

  function start() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') context.resume();
    return true;
  }

  // A returning visitor with sound left on: start the engine on their first click or key press.
  if (enabled) {
    const wake = () => {
      start();
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  }

  const ready = () => enabled && context && context.state === 'running';

  // ---- building blocks ----
  // One note: a tone that starts at "from" hertz, can glide to "to", and fades out.
  function tone({ from, to = from, length, volume = 0.2, type = 'sine', delay = 0, attack = 0.005 }) {
    const at = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  // A burst of hiss pushed through a filter that can sweep: clicks, whooshes and risers.
  function hiss({ from, to = from, length, volume = 0.2, sharpness = 1.2, delay = 0, attack = 0.01 }) {
    const at = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = sharpness;
    filter.frequency.setValueAtTime(from, at);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random() * 0.5);
    source.stop(at + length + 0.05);
  }

  const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]; // bright, always-in-tune notes
  let lastBlip = 0;

  // ---- the sounds, by name ----
  const sounds = {
    // Name intro: a rising sweep under the whole thing. "length" is how long the animation lasts.
    riser: ({ length = 2 } = {}) => {
      hiss({ from: 300, to: 5200, length, volume: 0.07, sharpness: 2.5, attack: length * 0.7 });
      tone({ from: 110, to: 440, length, volume: 0.06, type: 'sawtooth', attack: length * 0.8 });
    },
    // Name intro: one letter locking in. Too many at once would be a buzz, so extras are skipped.
    blip: () => {
      if (context.currentTime - lastBlip < 0.04) return;
      lastBlip = context.currentTime;
      const note = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone({ from: note * 2, length: 0.07, volume: 0.05, type: 'square' });
    },
    // Name intro: the name is complete. A big, warm, slightly retro chord.
    arrive: () => {
      for (const [i, note] of [130.81, 196, 261.63, 329.63, 392, 587.33].entries()) {
        tone({ from: note, length: 2.4, volume: 0.085, type: 'sawtooth', delay: i * 0.018, attack: 0.03 });
        tone({ from: note * 1.004, length: 2.4, volume: 0.06, type: 'triangle', delay: i * 0.018, attack: 0.03 });
      }
      hiss({ from: 6000, to: 1200, length: 1.2, volume: 0.05, sharpness: 0.8 });
    },
    // One layer of the cube turning: a plastic clack.
    turn: () => {
      hiss({ from: 2400 + Math.random() * 900, length: 0.06, volume: 0.22, sharpness: 3, attack: 0.002 });
      tone({ from: 190, to: 120, length: 0.07, volume: 0.1, type: 'triangle' });
    },
    // The cube is solved: four notes running upward.
    solved: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
        tone({ from: note, length: 0.5, volume: 0.13, type: 'triangle', delay: i * 0.085 });
      });
    },
    // A face is clicked and the cube bursts open.
    burst: () => {
      hiss({ from: 300, to: 4200, length: 0.55, volume: 0.25, sharpness: 0.9, attack: 0.08 });
      tone({ from: 90, to: 45, length: 0.5, volume: 0.22 });
    },
    // The cube pulls itself back together.
    gather: () => {
      hiss({ from: 3800, to: 260, length: 0.7, volume: 0.18, sharpness: 0.9, attack: 0.3 });
    },
    // A planet, asteroid or satellite is flicked.
    spin: () => {
      hiss({ from: 500, to: 2600, length: 0.35, volume: 0.12, sharpness: 1.6, attack: 0.05 });
    },
  };

  return {
    isOn: () => enabled,
    // Called from the toggle button, so the browser lets the audio engine start here.
    setOn(value) {
      enabled = value;
      try {
        localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
      } catch {
        // Nothing to do: the choice just will not be remembered.
      }
      if (value) start();
    },
    // Plays a sound by name if sound is on and the browser has let the engine start.
    play(name, options) {
      if (ready()) sounds[name]?.(options);
    },
    // True once sounds can actually be heard (used to decide whether replaying the intro is worth it).
    isReady: ready,
  };
}

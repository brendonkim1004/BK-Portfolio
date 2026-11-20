// All the site's sound. Nothing is downloaded: every sound is made on the spot with the
// browser's built-in synthesiser (Web Audio), so there are no audio files and no network calls.
//
// Sound is on unless the visitor has switched it off. Browsers decide when a page is allowed to
// make noise: usually only after a click, tap or key press on the site. So the engine is started
// straight away, and if the browser holds it back it starts on the first click, tap or key press.
const STORAGE_KEY = 'sound';
const LEVEL = 0.32; // overall volume: the one number to change if everything is too loud or quiet
const WIND = 0.12; // how loud the background wind is next to everything else

export function createSound() {
  let context = null;
  let master = null;
  let noise = null; // a few seconds of hiss, reused for the wind and every whoosh and click
  let enabled = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Private browsing can block storage; sound just starts on.
  }

  function start() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = enabled ? LEVEL : 0;
      master.connect(context.destination);

      noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      startWind();
    }
    // Stay silent in a background tab, and when sound is switched off.
    if (enabled && !document.hidden) context.resume();
    else context.suspend();
  }

  // Try now, and again on the first click, tap or key press in case the browser said no.
  start();
  const wake = () => {
    start();
    if (context?.state === 'running') {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    }
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  document.addEventListener('visibilitychange', () => context && start());

  const ready = () => enabled && context && context.state === 'running';

  // ---- background wind ----
  // Hiss through two soft filters. Two very slow wobbles (one moves the pitch, one the volume)
  // make it swell and fade like gusts instead of sounding like a steady hum.
  function startWind() {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 900;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 380;
    band.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = WIND * 0.6;

    const wobble = (rate, depth, target) => {
      const osc = context.createOscillator();
      const amount = context.createGain();
      osc.frequency.value = rate; // cycles per second: far below anything you can hear as a note
      amount.gain.value = depth;
      osc.connect(amount).connect(target);
      osc.start();
    };
    wobble(0.07, 170, band.frequency);
    wobble(0.031, 90, band.frequency);
    wobble(0.11, WIND * 0.3, gain.gain);

    source.connect(low).connect(band).connect(gain).connect(master);
    source.start();
  }

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

  // A burst of hiss pushed through a filter that can sweep: clicks and whooshes.
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
    source.start(at, Math.random() * 3);
    source.stop(at + length + 0.05);
  }

  // ---- the sounds, by name ----
  const sounds = {
    // Name intro: one letter appearing. A tiny dry click, slightly different each time so a run
    // of them sounds typed rather than like a machine.
    type: () => {
      const pitch = 0.9 + Math.random() * 0.25;
      hiss({ from: 3400 * pitch, length: 0.022, volume: 0.1, sharpness: 2.2, attack: 0.001 });
      tone({ from: 1500 * pitch, to: 900 * pitch, length: 0.02, volume: 0.035, type: 'square', attack: 0.001 });
    },
    // One layer of the cube turning: a plastic clack.
    turn: () => {
      hiss({ from: 2400 + Math.random() * 900, length: 0.06, volume: 0.14, sharpness: 3, attack: 0.002 });
      tone({ from: 190, to: 120, length: 0.07, volume: 0.07, type: 'triangle' });
    },
    // The cube is solved: four soft notes running upward.
    solved: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
        tone({ from: note, length: 0.5, volume: 0.07, type: 'triangle', delay: i * 0.085 });
      });
    },
    // A face is clicked and the cube bursts open.
    burst: () => {
      hiss({ from: 300, to: 3600, length: 0.55, volume: 0.14, sharpness: 0.9, attack: 0.08 });
      tone({ from: 90, to: 45, length: 0.5, volume: 0.13 });
    },
    // The cube pulls itself back together.
    gather: () => {
      hiss({ from: 3400, to: 260, length: 0.7, volume: 0.13, sharpness: 0.9, attack: 0.3 });
    },
    // A planet, asteroid or satellite is flicked.
    spin: () => {
      hiss({ from: 500, to: 2400, length: 0.35, volume: 0.08, sharpness: 1.6, attack: 0.05 });
    },
  };

  return {
    isOn: () => enabled,
    // Called from the corner switch.
    setOn(value) {
      enabled = value;
      try {
        localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
      } catch {
        // Nothing to do: the choice just will not be remembered.
      }
      start();
      // A short fade, so switching on or off never pops.
      if (context) master.gain.setTargetAtTime(value ? LEVEL : 0, context.currentTime, 0.05);
    },
    // Plays a sound by name if sound is on and the browser has let the engine start.
    play(name, options) {
      if (ready()) sounds[name]?.(options);
    },
  };
}

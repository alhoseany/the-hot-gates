export function createAudio() {
  let ctx = null;
  let muted = false;

  function context() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.05, slide = 0, delay = 0 }) {
    if (muted) return;
    const audio = context();
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide > 0) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur = 0.08, gain = 0.03, freq = 800) {
    if (muted) return;
    const audio = context();
    const t0 = audio.currentTime;
    const length = Math.floor(audio.sampleRate * dur);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = audio.createBufferSource();
    src.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const amp = audio.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(audio.destination);
    src.start(t0);
  }

  const play = {
    click: () => tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.03 }),
    deny: () => tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.02, slide: 90 }),
    place: () => {
      noise(0.09, 0.04, 240);
      tone({ freq: 140, dur: 0.14, type: 'triangle', gain: 0.05, slide: 70 });
    },
    sell: () => tone({ freq: 320, dur: 0.1, type: 'triangle', gain: 0.04, slide: 180 }),
    upgrade: () => {
      tone({ freq: 440, dur: 0.08, type: 'triangle', gain: 0.04 });
      tone({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.04, delay: 0.07 });
    },
    shot: () => tone({ freq: 720, dur: 0.04, type: 'square', gain: 0.012 }),
    oil: () => noise(0.12, 0.035, 180),
    hit: () => tone({ freq: 240, dur: 0.04, type: 'triangle', gain: 0.02 }),
    revive: () => tone({ freq: 196, dur: 0.2, type: 'sawtooth', gain: 0.03, slide: 392 }),
    leak: () => tone({ freq: 220, dur: 0.22, type: 'sawtooth', gain: 0.04, slide: 80 }),
    wave: () => {
      tone({ freq: 196, dur: 0.18, type: 'triangle', gain: 0.05 });
      tone({ freq: 294, dur: 0.28, type: 'triangle', gain: 0.04, delay: 0.12 });
    },
    betrayal: () => {
      tone({ freq: 146, dur: 0.4, type: 'sawtooth', gain: 0.04, slide: 70 });
      tone({ freq: 98, dur: 0.5, type: 'triangle', gain: 0.05, delay: 0.08 });
    },
    bonus: () => tone({ freq: 520, dur: 0.1, type: 'sine', gain: 0.035, slide: 780 }),
    bossdown: () => {
      tone({ freq: 392, dur: 0.16, type: 'triangle', gain: 0.05 });
      tone({ freq: 523, dur: 0.22, type: 'triangle', gain: 0.05, delay: 0.1 });
    },
    victory: () => {
      [523, 659, 784, 1046].forEach((freq, i) => {
        tone({ freq, dur: 0.22, type: 'triangle', gain: 0.05, delay: i * 0.12 });
      });
    },
    defeat: () => {
      tone({ freq: 311, dur: 0.3, type: 'triangle', gain: 0.05, slide: 140 });
      tone({ freq: 196, dur: 0.45, type: 'sine', gain: 0.04, delay: 0.18, slide: 90 });
    },
  };

  return {
    unlock() {
      context();
    },
    setMuted(value) {
      muted = value;
    },
    play(name) {
      const fn = play[name];
      if (!fn) return;
      try {
        fn();
      } catch {
        /* autoplay can reject before a gesture */
      }
    },
  };
}

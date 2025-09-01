// Lightweight Web Audio sound module for Neon Wreckage
// Handles: thrust (acceleration), shooting, asteroid explosions, boss entrance, boss defeat

let ctx = null;
let master = null;
let volume = 0.6;
let muted = false;

function ensureCtx(){
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
}

export function attachUnlock(target=document){
  // Unlock/resume AudioContext on first user gesture
  const unlock = async () => {
    ensureCtx();
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch(e){}
    target.removeEventListener('pointerdown', unlock);
    target.removeEventListener('keydown', unlock);
    target.removeEventListener('touchstart', unlock);
  };
  target.addEventListener('pointerdown', unlock, { once:true });
  target.addEventListener('keydown', unlock, { once:true });
  target.addEventListener('touchstart', unlock, { once:true });
}

// Utils
function now(){ ensureCtx(); return ctx.currentTime; }

function makeNoiseBuffer(seconds=0.5){
  ensureCtx();
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<length;i++) data[i] = (Math.random()*2 - 1) * 0.8;
  return buffer;
}

// Thrust (acceleration) — looped filtered noise with gain ramp
let thrustNode = null; // { src, filter, gain }

export function setThrust(active, intensity=1){
  ensureCtx();
  const t = now();
  if (active){
    if (!thrustNode){
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(0.35);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(220, t);
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start();
      thrustNode = { src, bp, g };
    }
    const target = Math.min(0.35, 0.2 + 0.2*intensity);
    thrustNode.g.gain.cancelScheduledValues(t);
    thrustNode.g.gain.setTargetAtTime(target, t, 0.03);
    // Slight frequency wiggle with intensity
    const base = 200 + 120*Math.min(1, intensity);
    thrustNode.bp.frequency.setTargetAtTime(base, t, 0.05);
  } else if (thrustNode){
    thrustNode.g.gain.cancelScheduledValues(t);
    thrustNode.g.gain.setTargetAtTime(0.0001, t, 0.05);
    // Leave running to avoid start/stop crackles during taps
  }
}

// Shooting — short pitch-down square blip
export function shoot(){
  ensureCtx();
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(180, t+0.10);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.22, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.14);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t+0.16);
}

// Explosion — noise burst + low boom
export function explosion(intensity=1){
  ensureCtx();
  const t = now();
  const i = Math.max(0.2, Math.min(1.5, intensity));
  // Noise burst
  {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(0.4);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(1800, t);
    const g = ctx.createGain();
    const a = 0.28 * i;
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (0.25 + 0.15*i));
    src.connect(lp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.6);
  }
  // Sub boom
  {
    const o = ctx.createOscillator();
    o.type='sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t+0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24*i, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.38);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t+0.42);
  }
}

// Boss entrance — whoosh + rising tone
export function bossEntrance(){
  ensureCtx();
  const t = now();
  // Whoosh (bandpassed noise)
  const src = ctx.createBufferSource(); src.buffer = makeNoiseBuffer(0.6); src.loop = false;
  const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.setValueAtTime(280, t); bp.Q.value = 1.0;
  const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.0001, t); g1.gain.linearRampToValueAtTime(0.25, t+0.05); g1.gain.exponentialRampToValueAtTime(0.0001, t+0.5);
  src.connect(bp).connect(g1).connect(master);
  src.start(t); src.stop(t+0.6);
  // Rising synth
  const o = ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t+0.6);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.18, t+0.08); g2.gain.exponentialRampToValueAtTime(0.0001, t+0.7);
  o.connect(g2).connect(master); o.start(t); o.stop(t+0.7);
}

// Boss defeat — layered big boom
export function bossDefeat(){
  ensureCtx();
  const t = now();
  // Big noise burst
  const src = ctx.createBufferSource(); src.buffer = makeNoiseBuffer(0.7);
  const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(2400, t);
  const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.35, t); g1.gain.exponentialRampToValueAtTime(0.0001, t+0.7);
  src.connect(lp).connect(g1).connect(master); src.start(t); src.stop(t+0.8);
  // Sub sweep
  const o = ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t+0.5);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.32, t); g2.gain.exponentialRampToValueAtTime(0.0001, t+0.55);
  o.connect(g2).connect(master); o.start(t); o.stop(t+0.58);
  // Crackle tail
  const src2 = ctx.createBufferSource(); src2.buffer = makeNoiseBuffer(0.25);
  const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.setValueAtTime(1200, t);
  const g3 = ctx.createGain(); g3.gain.setValueAtTime(0.12, t+0.1); g3.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
  src2.connect(hp).connect(g3).connect(master); src2.start(t+0.08); src2.stop(t+0.42);
  // Triumphant fanfare (major chord burst + short arpeggio)
  const fan = (freq, dt, dur, gain=0.18) => {
    const o = ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(freq, t+dt);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t+dt); g.gain.linearRampToValueAtTime(gain, t+dt+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t+dt+dur);
    o.connect(g).connect(master); o.start(t+dt); o.stop(t+dt+dur+0.02);
  };
  // C major-ish chord (C4, E4, G4) scaled
  const C4=262, E4=330, G4=392;
  fan(C4*2, 0.02, 0.35, 0.22);
  fan(E4*2, 0.02, 0.35, 0.18);
  fan(G4*2, 0.02, 0.35, 0.20);
  // Quick arpeggio tail
  fan(C4*3, 0.22, 0.22, 0.15);
  fan(E4*3, 0.30, 0.20, 0.13);
  fan(G4*3, 0.36, 0.20, 0.12);
}

export function setMasterVolume(v){ ensureCtx(); volume = Math.max(0, Math.min(1, v)); master.gain.value = muted?0:volume; }
export function getMasterVolume(){ return volume; }

export function setMuted(m){ ensureCtx(); muted=!!m; master.gain.value = muted?0:volume; }
export function toggleMute(){ setMuted(!muted); }
export function isMuted(){ return !!muted; }

// Power-up acquire — bright upward chirp
export function powerupPickup(type){
  ensureCtx();
  const t = now();
  const base = 500;
  const mult = 1 + (Math.abs(hash(type)) % 5) * 0.08; // slight variety by type
  const o = ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(base*mult, t); o.frequency.exponentialRampToValueAtTime(base*2.2*mult, t+0.18);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.22, t+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
  o.connect(g).connect(master); o.start(t); o.stop(t+0.25);
}

// Power-up expire — downward blip + soft noise
export function powerupExpire(type){
  ensureCtx();
  const t = now();
  const o = ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(220, t+0.18);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.2);
  o.connect(g).connect(master); o.start(t); o.stop(t+0.22);
  const n = ctx.createBufferSource(); n.buffer = makeNoiseBuffer(0.15); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; const gn=ctx.createGain(); gn.gain.value=0.06; n.connect(lp).connect(gn).connect(master); n.start(t); n.stop(t+0.14);
}

function hash(str){
  try { str = String(str||''); } catch(e){ str=''; }
  let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; }
  return h;
}

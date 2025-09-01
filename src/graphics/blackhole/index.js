// Black Hole renderer with layered components:
// - Lensing (refract base background frame)
// - Event horizon (hard disk + rim highlight)
// - Accretion disk (elliptical ring with Doppler shift: blue leading, red trailing) + streaks + glow
// - Post FX: bloom-ish glow, vignette, chromatic aberration hints, film grain

export function createBlackHole(canvas){
  const state = {
    enabled: false,
    w: canvas.width,
    h: canvas.height,
    config: defaultConfig(),
    t0: performance.now(),
    // Offscreen layer for black hole overlays (for post FX reuse)
    layer: document.createElement('canvas'),
    lctx: null,
    grain: makeGrain(128,128),
  };
  state.layer.width = state.w; state.layer.height = state.h; state.lctx = state.layer.getContext('2d');

  function defaultConfig(){
    return {
      x: 0.5, y: 0.5, // normalized center
      radius: 240,
      strength: 0.14,
      rings: 22,
      outerScale: 2.25,
      pulseSpeed: 1.4,
      pulseAmount: 0.35,
      discTilt: 0.62,
      discSpin: 0.15, // radians per second
      doppler: 0.85, // blue/red intensity factor
      streaks: 10,
      vignette: 0.18,
      bloom: 0.6,
      chroma: 0.7,
    };
  }

  function resize(){ state.w = canvas.width; state.h = canvas.height; state.layer.width=state.w; state.layer.height=state.h; }

  function setEnabled(v){ state.enabled = !!v; }
  function setConfig(cfg){ state.config = { ...state.config, ...cfg }; }

  function render(ctx, baseFrame){
    if (!state.enabled){ ctx.drawImage(baseFrame,0,0); return; }
    const t = (performance.now() - state.t0)/1000;
    const cfg = state.config; const cx = state.w*cfg.x, cy = state.h*cfg.y; const R = cfg.radius;
    // LENSING: draw base, then refract annuli
    ctx.drawImage(baseFrame,0,0);
    const Kbase = Math.max(0.02, cfg.strength);
    const pulse = 0.5 + 0.5*Math.sin(t * cfg.pulseSpeed * Math.PI*2);
    const K = Kbase * (1 + cfg.pulseAmount * (pulse - 0.5) * 2);
    const rings = Math.max(8, cfg.rings|0); const outer = R * (cfg.outerScale || 2.0); const dr = (outer - R)/rings;
    for(let i=0;i<rings;i++){
      const r0 = R + i*dr; const r1 = r0 + dr; const mid=(r0+r1)*0.5; const fall=Math.max(0,1-(mid-R)/(outer-R));
      const s = 1 + K * Math.pow(fall, 0.85); if (s<=1.001) continue;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r1, 0, Math.PI*2); ctx.arc(cx, cy, r0, 0, Math.PI*2, true); ctx.closePath(); ctx.clip('evenodd');
      ctx.translate(cx,cy); ctx.scale(s,s); ctx.translate(-cx,-cy);
      ctx.drawImage(baseFrame,0,0);
      ctx.restore();
    }
    // Inner compression
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R*0.92,0,Math.PI*2); ctx.clip();
    const sIn = Math.max(0.78, 1 - K*1.8);
    ctx.translate(cx,cy); ctx.scale(sIn,sIn); ctx.translate(-cx,-cy); ctx.drawImage(baseFrame,0,0); ctx.restore();

    // Build BH overlay into layer for post FX
    const l = state.lctx; l.clearRect(0,0,state.w,state.h);

    // ACCRETION DISK base (elliptical ring)
    const tilt = clamp(cfg.discTilt, 0.3, 1.0);
    const outerDisk = R*1.85, innerDisk = R*0.78; const spin = t * cfg.discSpin;
    l.save(); l.translate(cx,cy); l.rotate(spin); l.scale(1, tilt);
    // disk base glow
    let disk = l.createRadialGradient(0,0, innerDisk*0.9, 0,0, outerDisk);
    const redA  = 0.20 + 0.12*pulse;
    const goldA = 0.26 + 0.20*pulse;
    disk.addColorStop(0.00, 'rgba(0,0,0,0)');
    disk.addColorStop(0.45, rgba('#ff3322', redA*0.5));
    disk.addColorStop(0.60, rgba('#ff8833', redA));
    disk.addColorStop(0.78, rgba('#ffee88', goldA));
    disk.addColorStop(1.00, 'rgba(0,0,0,0)');
    l.globalCompositeOperation='lighter';
    l.fillStyle = disk; l.beginPath(); l.arc(0,0, outerDisk, 0, Math.PI*2); l.fill();
    // Doppler shift halves
    const dop = clamp(cfg.doppler, 0, 2);
    // leading (blue)
    l.globalAlpha = 0.55; fillHalfRing(l, innerDisk*0.95, outerDisk*0.98, 0, Math.PI, rgba('#66d9ff', 0.6*dop));
    // trailing (red)
    l.globalAlpha = 0.55; fillHalfRing(l, innerDisk*0.95, outerDisk*0.98, Math.PI, Math.PI*2, rgba('#ff3355', 0.6*dop));
    l.globalAlpha = 1;
    // streaks
    drawStreaks(l, innerDisk*1.02, outerDisk*0.98, cfg.streaks, pulse);
    l.globalCompositeOperation='source-over'; l.restore();

    // EVENT HORIZON (hard disk + rim highlight)
    const core = l.createRadialGradient(cx, cy, 0, cx, cy, R*0.98);
    core.addColorStop(0, 'rgba(0,0,0,1)'); core.addColorStop(1, 'rgba(0,0,0,0.95)');
    l.fillStyle = core; l.beginPath(); l.arc(cx, cy, R, 0, Math.PI*2); l.fill();
    // rim highlight
    const rim = l.createRadialGradient(cx, cy, R*0.85, cx, cy, R*1.08);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(0.65, rgba('#ffeeaa', 0.18 + 0.12*pulse));
    rim.addColorStop(0.92, rgba('#ffffff', 0.10 + 0.10*pulse));
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    l.globalCompositeOperation='lighter'; l.fillStyle = rim; l.beginPath(); l.arc(cx, cy, R*1.08, 0, Math.PI*2); l.fill(); l.globalCompositeOperation='source-over';

    // POST FX: bloom (shadow blur), chromatic aberration arcs, vignette, film grain
    // Bloom pass: draw overlay with shadow blur
    ctx.save(); ctx.shadowColor = 'rgba(255,230,150,0.55)'; ctx.shadowBlur = Math.floor(24 * clamp(cfg.bloom,0,2));
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha = 0.9;
    ctx.drawImage(state.layer,0,0); ctx.restore(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    // Chromatic aberration hint: thin colored arcs slightly offset
    drawChromaticArcs(ctx, cx, cy, R*1.2, 1.5*clamp(cfg.chroma,0,2));
    // Vignette
    drawVignette(ctx, clamp(cfg.vignette, 0, 0.6));
    // Film grain
    drawGrain(ctx, state.grain, 0.035);
  }

  function fillHalfRing(l, rInner, rOuter, start, end, color){
    l.save(); l.fillStyle = color; l.beginPath(); l.arc(0,0,rOuter,start,end); l.arc(0,0,rInner,end,start,true); l.closePath(); l.fill(); l.restore();
  }
  function drawStreaks(l, rInner, rOuter, count, pulse){
    const rng = seeded(1337);
    for(let i=0;i<count;i++){
      const ang = rng()*Math.PI*2; const len = (0.02 + rng()*0.05) * (rOuter);
      const r = (rInner + rOuter)*0.5 + (rng()-0.5)*rOuter*0.05;
      const a = 0.08 + 0.10*Math.abs(Math.sin(ang*3 + pulse*6));
      const x = Math.cos(ang)*r, y = Math.sin(ang)*r; const dx = Math.cos(ang)*len, dy = Math.sin(ang)*len;
      l.save(); l.translate(x+dx* -0.5, y+dy* -0.5); l.rotate(ang); l.globalAlpha = a;
      const grad = l.createLinearGradient(0,0,len,0); grad.addColorStop(0, rgba('#ffee88', 0)); grad.addColorStop(0.5, rgba('#ffffff', 0.6)); grad.addColorStop(1, rgba('#ff8899', 0));
      l.fillStyle = grad; l.fillRect(0, -1.1, len, 2.2);
      l.restore();
    }
  }
  function drawChromaticArcs(ctx, cx, cy, r, amt){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle='rgba(255,80,100,0.12)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx+amt, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(100,220,255,0.12)'; ctx.beginPath(); ctx.arc(cx-amt, cy, r*1.02, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  function drawVignette(ctx, strength){
    const w=state.w, h=state.h; const maxR = Math.hypot(w,h)/1.2; const g = ctx.createRadialGradient(w/2,h/2, maxR*0.55, w/2,h/2, maxR);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.save(); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); ctx.restore();
  }
  function makeGrain(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); const id=x.createImageData(w,h); for(let i=0;i<id.data.length;i+=4){ const n=(Math.random()*255)|0; id.data[i]=n; id.data[i+1]=n; id.data[i+2]=n; id.data[i+3]=255; } x.putImageData(id,0,0); return c; }
  function drawGrain(ctx, tex, a){ const w=state.w, h=state.h; const ox=(Math.random()*tex.width)|0, oy=(Math.random()*tex.height)|0; ctx.save(); ctx.globalAlpha=a; for(let y=-oy;y<h;y+=tex.height){ for(let x=-ox;x<w;x+=tex.width){ ctx.drawImage(tex, x, y); } } ctx.restore(); }
  function rgba(hex, a){ const h=hex.replace('#',''); const r=parseInt(h.length===3? h[0]+h[0]:h.slice(0,2),16), g=parseInt(h.length===3? h[1]+h[1]:h.slice(2,4),16), b=parseInt(h.length===3? h[2]+h[2]:h.slice(4,6),16); return `rgba(${r},${g},${b},${a})`; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function seeded(s){ let x=s|0; return function(){ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; } }

  return {
    resize,
    setEnabled,
    setConfig,
    render,
    get enabled(){ return state.enabled; },
    get config(){ return state.config; },
  };
}


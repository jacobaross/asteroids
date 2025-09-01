// Starry background with layered parallax stars and nebulas
// Designed to be visually subtle and easily tweakable.

export function createBackground(canvas){
  const state = {
    w: canvas.width,
    h: canvas.height,
    lastT: performance.now(),
    starLayers: [], // {canvas, speed, offsetX, offsetY}
    nebulaLayers: [], // {canvas, speed, offsetX, offsetY}
    config: defaultConfig(),
    parallax: { vx: 0, vy: 0 },
    frame: null,
    fctx: null,
  };

  function defaultConfig(){
    return {
      stars: [
        { count: 220, minSize: 0.6, maxSize: 1.4, minA: 0.12, maxA: 0.22, speed: 0.015 }, // far
        { count: 160, minSize: 0.9, maxSize: 1.9, minA: 0.16, maxA: 0.28, speed: 0.035 }, // mid
        { count: 120, minSize: 1.2, maxSize: 2.4, minA: 0.20, maxA: 0.34, speed: 0.065 }, // near
      ],
      nebulas: [
        { blobs: 5, scale: 1.6, alpha: 0.12, speed: 0.010 },
        { blobs: 4, scale: 1.3, alpha: 0.09, speed: 0.006 },
      ],
      driftDir: { x: 1, y: 0.45 }, // diagonal gentle drift
      starParallax: 0.35, // how much stars respond to ship velocity
      nebulaParallax: 0.12, // nebulas respond less than stars
      palette: {
        stars: ['#e6f7ff', '#d0f0ff', '#b8eaff', '#cfe7ff'],
        nebulas: ['#2a0b3a', '#3b0f4e', '#0b2a3a', '#142a4e', '#2a0f3a', '#1a2a4e', '#331144', '#103049'],
        highlights: ['#ff66aa', '#66d9ff', '#a177ff']
      }
    };
  }

  function rand(a,b){ return a + Math.random()*(b-a); }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  function makeOffscreen(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

  function buildStars(w,h){
    const total = state.config.stars.length || 1;
    state.starLayers = state.config.stars.map((cfg, idx) => {
      const c = makeOffscreen(w,h); const cx = c.getContext('2d');
      cx.clearRect(0,0,w,h);
      for(let i=0;i<cfg.count;i++){
        const x = Math.random()*w; const y = Math.random()*h;
        const r = rand(cfg.minSize, cfg.maxSize);
        const a = rand(cfg.minA, cfg.maxA);
        const color = pick(state.config.palette.stars);
        // radial glow
        const g = cx.createRadialGradient(x,y,0, x,y, r*3.0);
        g.addColorStop(0, hexToRgba(color, a));
        g.addColorStop(0.35, hexToRgba(color, a*0.7));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(x,y,r*3.0,0,Math.PI*2); cx.fill();
        // core
        cx.fillStyle = hexToRgba('#ffffff', Math.min(0.35, a*1.6));
        cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill();
      }
      const depth = (idx+1)/total; // far -> near
      const par = state.config.starParallax * depth;
      return { canvas: c, speed: cfg.speed, ox: 0, oy: 0, parallax: par };
    });
  }

  function buildNebulas(w,h){
    // Treat first config entry as farther than later ones
    const total = state.config.nebulas.length || 1;
    state.nebulaLayers = state.config.nebulas.map((cfg, idx) => {
      const scale = cfg.scale;
      const W = Math.ceil(w*scale), H = Math.ceil(h*scale);
      const c = makeOffscreen(W,H); const cx = c.getContext('2d');
      cx.clearRect(0,0,W,H);
      cx.globalCompositeOperation = 'lighter';
      const palette = state.config.palette.nebulas;
      const highlights = state.config.palette.highlights;
      for(let i=0;i<cfg.blobs;i++){
        const cx0 = rand(W*0.1, W*0.9); const cy0 = rand(H*0.1, H*0.9);
        const baseR = Math.max(W,H) * rand(0.18, 0.33);
        const col = Math.random()<0.25 ? pick(highlights) : pick(palette);
        // Layered soft circles to approximate a cloudy nebula patch
        const layers = 5 + (Math.random()*4|0);
        for(let k=0;k<layers;k++){
          const r = baseR * rand(0.4, 1.0);
          const dx = rand(-baseR*0.2, baseR*0.2);
          const dy = rand(-baseR*0.2, baseR*0.2);
          const a = cfg.alpha * rand(0.35, 1.0);
          const grad = cx.createRadialGradient(cx0+dx, cy0+dy, r*0.1, cx0+dx, cy0+dy, r);
          grad.addColorStop(0, hexToRgba(col, a));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = grad;
          cx.beginPath(); cx.arc(cx0+dx, cy0+dy, r, 0, Math.PI*2); cx.fill();
        }
      }
      cx.globalCompositeOperation = 'source-over';
      const depth = (idx+1)/total;
      const par = state.config.nebulaParallax * depth;
      return { canvas: c, speed: cfg.speed, ox: 0, oy: 0, parallax: par };
    });
  }

  function hexToRgba(hex, a){
    const h = hex.replace('#','');
    const r = parseInt(h.length===3? h[0]+h[0] : h.slice(0,2),16);
    const g = parseInt(h.length===3? h[1]+h[1] : h.slice(2,4),16);
    const b = parseInt(h.length===3? h[2]+h[2] : h.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function ensureFrame(){
    if (!state.frame || state.frame.width!==state.w || state.frame.height!==state.h){
      state.frame = document.createElement('canvas');
      state.frame.width = state.w; state.frame.height = state.h;
      state.fctx = state.frame.getContext('2d');
    }
  }

  function resize(){
    state.w = canvas.width; state.h = canvas.height;
    buildStars(state.w, state.h);
    buildNebulas(state.w, state.h);
    ensureFrame();
  }

  function update(){
    const t = performance.now();
    const dt = Math.max(0.5, Math.min(3, (t - state.lastT) / 16.6667)); // normalize to ~frames
    state.lastT = t;
    const dx = state.config.driftDir.x;
    const dy = state.config.driftDir.y;
    // base drift
    for(const L of state.nebulaLayers){ L.ox = (L.ox + dx * L.speed * dt) % L.canvas.width; L.oy = (L.oy + dy * L.speed * dt) % L.canvas.height; }
    for(const L of state.starLayers){ L.ox = (L.ox + dx * L.speed * 2 * dt) % state.w; L.oy = (L.oy + dy * L.speed * 2 * dt) % state.h; }
    // parallax from ship velocity
    if (state.parallax){
      const pvx = state.parallax.vx; const pvy = state.parallax.vy;
      if (pvx || pvy){
        for(const L of state.nebulaLayers){ L.ox = (L.ox - pvx * L.parallax * dt); L.oy = (L.oy - pvy * L.parallax * dt); }
        for(const L of state.starLayers){ L.ox = (L.ox - pvx * L.parallax * dt); L.oy = (L.oy - pvy * L.parallax * dt); }
      }
    }
  }

  function drawTiled(ctx, img, ox, oy, targetW, targetH){
    // Draw the layer with wrapping; cover viewport by drawing up to 4 tiles
    const w = img.width, h = img.height;
    let x = - (ox % w), y = - (oy % h);
    if (x>0) x -= w; if (y>0) y -= h;
    for(let iy=0; iy<2 + Math.ceil(targetH/h); iy++){
      for(let ix=0; ix<2 + Math.ceil(targetW/w); ix++){
        ctx.drawImage(img, Math.floor(x + ix*w), Math.floor(y + iy*h));
      }
    }
  }

  function drawBase(ctx){
    // Draw nebulas and stars into provided ctx
    ctx.clearRect(0,0,state.w,state.h);
    for(const L of state.nebulaLayers){ drawTiled(ctx, L.canvas, L.ox, L.oy, state.w, state.h); }
    for(const L of state.starLayers){ drawTiled(ctx, L.canvas, L.ox, L.oy, state.w, state.h); }
  }
  function compose(){ update(); ensureFrame(); drawBase(state.fctx); return state.frame; }
  function draw(ctx){ const base = compose(); ctx.drawImage(base, 0, 0); }

  // initial build
  resize();

  return {
    resize,
    draw,
    setConfig(cfg){ state.config = { ...state.config, ...cfg }; resize(); },
    compose,
    getFrame(){ return compose(); },
    setParallax(vx, vy){ state.parallax.vx = vx||0; state.parallax.vy = vy||0; },
    get state(){ return state; }
  };
}

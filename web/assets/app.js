/**
 * Garuda Sentinel // Tactical Command Center Engine (`web/assets/app.js`)
 * 60 FPS HTML5 Canvas 2D Radar, Geodesic Bezier Trajectories,
 * Real-Time Threat Stream, and Military Tactical HUD.
 */

(function () {
  'use strict';

  // Geodesic bounds configuration
  const GEO_BOUNDS = {
    lngMin: 94.0,
    lngMax: 141.5,
    latMin: -11.5,
    latMax: 6.5
  };

  // 8 National IXP Defense Nodes
  const IXP_NODES = [
    { code: "JKT-IXP", city: "Jakarta", lat: -6.2088, lng: 106.8456, name: "Jakarta (IIX/OpenIXP)" },
    { code: "SUB-IXP", city: "Surabaya", lat: -7.2575, lng: 112.7521, name: "Surabaya (East Java)" },
    { code: "BTH-IXP", city: "Batam", lat: 1.1301, lng: 104.0529, name: "Batam (Cross-Border)" },
    { code: "KNO-IXP", city: "Medan", lat: 3.5952, lng: 98.6722, name: "Medan (Sumatra Gateway)" },
    { code: "UPG-IXP", city: "Makassar", lat: -5.1477, lng: 119.4327, name: "Makassar (Eastern Hub)" },
    { code: "DPS-IXP", city: "Denpasar", lat: -8.6705, lng: 115.2126, name: "Denpasar (Bali/NT)" },
    { code: "BPN-IXP", city: "Balikpapan", lat: -1.2654, lng: 116.8312, name: "Balikpapan (IKN Hub)" },
    { code: "DJJ-IXP", city: "Jayapura", lat: -2.5337, lng: 140.7181, name: "Jayapura (Papua Gateway)" },
  ];

  // Tactical Perimeter Sectors
  const PERIMETER_GATES = [
    { name: "NORTH-WEST", lat: 6.5, lng: 98.0, side: "top" },
    { name: "NORTH", lat: 6.5, lng: 118.0, side: "top" },
    { name: "NORTH-EAST", lat: 6.5, lng: 136.0, side: "top" },
    { name: "WEST", lat: -1.0, lng: 94.0, side: "left" },
    { name: "SOUTH-WEST", lat: -11.5, lng: 102.0, side: "bottom" },
    { name: "SOUTH", lat: -11.5, lng: 118.0, side: "bottom" },
    { name: "EAST", lat: -5.0, lng: 141.5, side: "right" },
  ];

  // Tactical audio synthesizer
  class TacticalAudio {
    constructor() {
      this.ctx = null;
      this.enabled = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
    }

    toggle() {
      this.init();
      this.enabled = !this.enabled;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.enabled;
    }

    playBlip(freq = 880, duration = 0.04) {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) { }
    }

    playLaserLaunch() {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) { }
    }

    playImpact() {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } catch (e) { }
    }
  }

  const audio = new TacticalAudio();

  // Application state
  const state = {
    summary: null,
    events: [],
    geoJson: null,
    selectedEvent: null,
    filterSeverity: 'ALL',
    activeLasers: [],
    impactRipples: [],
    radarAngle: 0,
    speedMultiplier: 1.0,
    isPaused: false,
    hoveredNode: null,
    mousePos: { x: 0, y: 0 },
    eventQueueIndex: 0,
    lastSpawnTime: 0
  };

  // Canvas coordinate projector
  class MapProjector {
    constructor(canvas) {
      this.canvas = canvas;
      this.updateDimensions();
    }

    updateDimensions() {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.padX = this.width * 0.045;
      this.padY = this.height * 0.08;
      this.innerW = this.width - this.padX * 2;
      this.innerH = this.height - this.padY * 2;
    }

    project(lng, lat) {
      const x = this.padX + ((lng - GEO_BOUNDS.lngMin) / (GEO_BOUNDS.lngMax - GEO_BOUNDS.lngMin)) * this.innerW;
      const y = this.padY + ((GEO_BOUNDS.latMax - lat) / (GEO_BOUNDS.latMax - GEO_BOUNDS.latMin)) * this.innerH;
      return { x, y };
    }

    unproject(x, y) {
      const lng = GEO_BOUNDS.lngMin + ((x - this.padX) / this.innerW) * (GEO_BOUNDS.lngMax - GEO_BOUNDS.lngMin);
      const lat = GEO_BOUNDS.latMax - ((y - this.padY) / this.innerH) * (GEO_BOUNDS.latMax - GEO_BOUNDS.latMin);
      return { lng, lat };
    }
  }

  // Radar canvas engine
  let canvas, ctx, projector;
  let cachedLandPath = null;

  function initCanvas() {
    canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    projector = new MapProjector(canvas);

    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      rebuildCachedPolygons();
    });

    // Mouse movement on canvas for HUD coordinates & node hover
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      state.mousePos.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      state.mousePos.y = (e.clientY - rect.top) * (canvas.height / rect.height);

      // Check hovered node
      let foundNode = null;
      for (const node of IXP_NODES) {
        const pt = projector.project(node.lng, node.lat);
        const dist = Math.hypot(state.mousePos.x - pt.x, state.mousePos.y - pt.y);
        if (dist < 18) {
          foundNode = node;
          break;
        }
      }
      state.hoveredNode = foundNode;
      canvas.style.cursor = foundNode ? 'pointer' : 'crosshair';

      // Update HUD mouse coordinate text
      const geo = projector.unproject(state.mousePos.x, state.mousePos.y);
      const latStr = `${Math.abs(geo.lat).toFixed(2)}°${geo.lat >= 0 ? 'N' : 'S'}`;
      const lngStr = `${geo.lng.toFixed(2)}°E`;
      const coordEl = document.getElementById('hud-cursor-coords');
      if (coordEl) coordEl.textContent = `TGT: ${latStr} ${lngStr}`;
    });

    canvas.addEventListener('click', () => {
      if (state.hoveredNode) {
        audio.playBlip(1200, 0.06);
        filterLogsByNode(state.hoveredNode.code);
      }
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    projector.width = w;
    projector.height = h;
    projector.padX = w * 0.045;
    projector.padY = h * 0.08;
    projector.innerW = w - projector.padX * 2;
    projector.innerH = h - projector.padY * 2;
  }

  function rebuildCachedPolygons() {
    if (!state.geoJson || !projector) return;
    try {
      const path = new Path2D();
      state.geoJson.features.forEach((feat) => {
        const geom = feat.geometry;
        if (geom.type === 'Polygon') {
          drawRingsToPath(path, geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
          geom.coordinates.forEach((rings) => {
            drawRingsToPath(path, rings);
          });
        }
      });
      cachedLandPath = path;
    } catch (e) {
      console.error('Error rebuilding land polygons:', e);
    }
  }

  function drawRingsToPath(path, rings) {
    rings.forEach((ring) => {
      for (let i = 0; i < ring.length; i++) {
        const pt = projector.project(ring[i][0], ring[i][1]);
        if (i === 0) path.moveTo(pt.x, pt.y);
        else path.lineTo(pt.x, pt.y);
      }
      path.closePath();
    });
  }

  // Laser trajectory mechanics
  function spawnAttackLaser(eventData) {
    if (!eventData) return;

    let startX, startY;
    if (eventData.perimeter_entry) {
      const p = projector.project(eventData.perimeter_entry.lng, eventData.perimeter_entry.lat);
      startX = p.x;
      startY = p.y;
    } else {
      startX = projector.padX;
      startY = projector.padY;
    }

    const targetPos = projector.project(eventData.target.lng, eventData.target.lat);

    // Ballistic / Tactical trajectory curve
    const midX = (startX + targetPos.x) / 2;
    const midY = (startY + targetPos.y) / 2;
    const dist = Math.hypot(targetPos.x - startX, targetPos.y - startY);

    // Perpendicular elevation
    const angle = Math.atan2(targetPos.y - startY, targetPos.x - startX);
    const curveElev = Math.min(dist * 0.35, 90) * (startX > targetPos.x ? -1 : 1);
    const ctrlX = midX - Math.sin(angle) * curveElev;
    const ctrlY = midY + Math.cos(angle) * curveElev - 25;

    const isCritical = eventData.attack.severity === 'CRITICAL';
    const isDomestic = eventData.origin.country === 'ID';

    state.activeLasers.push({
      event: eventData,
      startX,
      startY,
      ctrlX,
      ctrlY,
      endX: targetPos.x,
      endY: targetPos.y,
      progress: 0,
      speed: (isCritical ? 0.016 : 0.011) * state.speedMultiplier,
      color: isDomestic ? '#00F0FF' : isCritical ? '#FF1E27' : '#FF7A00',
      trailLength: 0.18,
      targetCity: eventData.target.city
    });

    audio.playLaserLaunch();
  }

  function triggerImpact(x, y, color) {
    state.impactRipples.push({
      x,
      y,
      radius: 2,
      maxRadius: 28,
      alpha: 1.0,
      color
    });
    audio.playImpact();
  }

  // Canvas animation render loop
  function renderCanvas(timestamp) {
    if (!canvas || !ctx || !projector) {
      requestAnimationFrame(renderCanvas);
      return;
    }

    const w = projector.width;
    const h = projector.height;

    // 1. Clear background
    ctx.clearRect(0, 0, w, h);

    // Base tactical grid
    renderGrid(w, h);

    // Concentric Range Rings centered at Central Indonesia (Makassar Strait)
    const centerPoint = projector.project(118.0, -2.5);
    renderConcentricRings(centerPoint.x, centerPoint.y);

    // Rotating Radar Sweep
    if (!state.isPaused) {
      state.radarAngle += 0.012 * state.speedMultiplier;
      if (state.radarAngle >= Math.PI * 2) state.radarAngle = 0;
    }
    renderRadarSweep(centerPoint.x, centerPoint.y);

    // 2. Indonesia Landmass Polygons
    if (cachedLandPath) {
      ctx.save();
      // Land interior fill
      ctx.fillStyle = '#140406';
      ctx.fill(cachedLandPath);

      // Deep crimson outline
      ctx.strokeStyle = '#450A0E';
      ctx.lineWidth = 1.2;
      ctx.stroke(cachedLandPath);

      // Coastline subtle neon edge
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
      ctx.lineWidth = 0.6;
      ctx.stroke(cachedLandPath);
      ctx.restore();
    }

    // 3. Perimeter Entry Sectors & Markers
    renderPerimeterGates(w, h);

    // 4. Attack Lasers (Quadratic Bezier)
    renderLasers();

    // 5. Impact Detonations
    renderImpacts();

    // 6. National IXP Gateway Target Nodes
    renderIXPNodes(timestamp);

    // 7. Tactical Crosshair / Cursor HUD
    renderCrosshairHUD();

    // Spawn new attack events periodically
    if (!state.isPaused && state.events.length > 0) {
      if (!state.lastSpawnTime) state.lastSpawnTime = timestamp;
      const interval = 1600 / state.speedMultiplier;
      if (timestamp - state.lastSpawnTime > interval) {
        const ev = state.events[state.eventQueueIndex % state.events.length];
        state.eventQueueIndex++;
        spawnAttackLaser(ev);
        state.lastSpawnTime = timestamp;
      }
    }

    requestAnimationFrame(renderCanvas);
  }

  // Sub-routines for grid, rings, and telemetry
  function renderGrid(w, h) {
    ctx.save();
    ctx.strokeStyle = '#1F0608';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Longitude lines (95°E to 140°E step 5°)
    for (let lng = 95; lng <= 140; lng += 5) {
      const p1 = projector.project(lng, GEO_BOUNDS.latMax);
      const p2 = projector.project(lng, GEO_BOUNDS.latMin);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Top label
      ctx.fillStyle = '#6B2326';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${lng}°E`, p1.x + 3, projector.padY - 8);
    }

    // Latitude lines (-10°S to 5°N step 5°)
    for (let lat = -10; lat <= 5; lat += 5) {
      const p1 = projector.project(GEO_BOUNDS.lngMin, lat);
      const p2 = projector.project(GEO_BOUNDS.lngMax, lat);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Left label
      ctx.fillStyle = '#6B2326';
      ctx.font = '9px "JetBrains Mono", monospace';
      const label = `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`;
      ctx.fillText(label, projector.padX - 28, p1.y + 3);
    }

    // Outer Bounding Box Border
    ctx.setLineDash([]);
    ctx.strokeStyle = '#450A0E';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(projector.padX, projector.padY, projector.innerW, projector.innerH);

    // Corner HUD Brackets on Canvas
    const len = 14;
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(projector.padX, projector.padY + len);
    ctx.lineTo(projector.padX, projector.padY);
    ctx.lineTo(projector.padX + len, projector.padY);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(projector.padX + projector.innerW - len, projector.padY);
    ctx.lineTo(projector.padX + projector.innerW, projector.padY);
    ctx.lineTo(projector.padX + projector.innerW, projector.padY + len);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(projector.padX, projector.padY + projector.innerH - len);
    ctx.lineTo(projector.padX, projector.padY + projector.innerH);
    ctx.lineTo(projector.padX + len, projector.padY + projector.innerH);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(projector.padX + projector.innerW - len, projector.padY + projector.innerH);
    ctx.lineTo(projector.padX + projector.innerW, projector.padY + projector.innerH);
    ctx.lineTo(projector.padX + projector.innerW, projector.padY + projector.innerH - len);
    ctx.stroke();

    ctx.restore();
  }

  function renderConcentricRings(cx, cy) {
    ctx.save();
    ctx.strokeStyle = 'rgba(136, 19, 27, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);

    const radii = [120, 240, 360, 480];
    const labels = ['500 KM', '1000 KM', '1500 KM', '2000 KM'];

    radii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(159, 107, 110, 0.45)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(labels[idx], cx + r - 35, cy - 4);
    });

    ctx.restore();
  }

  function renderRadarSweep(cx, cy) {
    ctx.save();
    const radius = Math.max(projector.width, projector.height) * 0.75;

    // Wedge gradient
    const sweepAngle = Math.PI * 0.35; // 63 degrees fan
    const startAngle = state.radarAngle - sweepAngle;
    const endAngle = state.radarAngle;

    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
    grad.addColorStop(0, 'rgba(255, 30, 39, 0.25)');
    grad.addColorStop(0.5, 'rgba(255, 30, 39, 0.08)');
    grad.addColorStop(1, 'rgba(255, 30, 39, 0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Leading crisp laser sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(endAngle) * radius, cy + Math.sin(endAngle) * radius);
    ctx.strokeStyle = 'rgba(255, 122, 0, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  function renderPerimeterGates(w, h) {
    ctx.save();
    PERIMETER_GATES.forEach((gate) => {
      const pt = projector.project(gate.lng, gate.lat);

      // Gate beacon marker
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);

      // Blinking outer diamond
      ctx.strokeStyle = 'rgba(255, 30, 39, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pt.x - 6, pt.y - 6, 12, 12);

      // Sector tag
      ctx.fillStyle = '#9F6B6E';
      ctx.font = '9px "Orbitron", monospace';
      let tagX = pt.x;
      let tagY = pt.y;

      if (gate.side === 'top') {
        tagY -= 12;
        ctx.textAlign = 'center';
      } else if (gate.side === 'bottom') {
        tagY += 18;
        ctx.textAlign = 'center';
      } else if (gate.side === 'left') {
        tagX += 10;
        tagY += 3;
        ctx.textAlign = 'left';
      } else {
        tagX -= 10;
        tagY += 3;
        ctx.textAlign = 'right';
      }
      ctx.fillText(`GATE // ${gate.name}`, tagX, tagY);
    });
    ctx.restore();
  }

  function renderLasers() {
    ctx.save();

    for (let i = state.activeLasers.length - 1; i >= 0; i--) {
      const laser = state.activeLasers[i];
      laser.progress += laser.speed;

      if (laser.progress >= 1.0) {
        // Trigger impact at destination
        triggerImpact(laser.endX, laser.endY, laser.color);
        state.activeLasers.splice(i, 1);
        continue;
      }

      // Draw trailing segment along quadratic bezier
      const pHead = getQuadPoint(laser.startX, laser.startY, laser.ctrlX, laser.ctrlY, laser.endX, laser.endY, laser.progress);
      const tailProgress = Math.max(0, laser.progress - laser.trailLength);
      const pTail = getQuadPoint(laser.startX, laser.startY, laser.ctrlX, laser.ctrlY, laser.endX, laser.endY, tailProgress);

      // Trailing glow
      ctx.beginPath();
      ctx.moveTo(pTail.x, pTail.y);
      // Sample a few points along curve for smoothness
      const midProgress = (laser.progress + tailProgress) / 2;
      const pMid = getQuadPoint(laser.startX, laser.startY, laser.ctrlX, laser.ctrlY, laser.endX, laser.endY, midProgress);
      ctx.quadraticCurveTo(pMid.x, pMid.y, pHead.x, pHead.y);

      ctx.strokeStyle = laser.color;
      ctx.lineWidth = laser.event.attack.severity === 'CRITICAL' ? 2.4 : 1.6;
      ctx.shadowColor = laser.color;
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Laser projectile head
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pHead.x, pHead.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Threat label hovering above projectile
      if (laser.progress > 0.15 && laser.progress < 0.85) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = laser.color;
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const az = laser.event.perimeter_entry ? laser.event.perimeter_entry.azimuth_deg : '---';
        const attackTag = `[${laser.event.origin.country} ➜ ${laser.event.target.code}] AZ ${az}° /// ${laser.event.attack.type}`;
        ctx.fillText(attackTag, pHead.x, pHead.y - 8);
      }
    }

    ctx.restore();
  }

  function getQuadPoint(x0, y0, cx, cy, x1, y1, t) {
    const invT = 1 - t;
    const x = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
    const y = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
    return { x, y };
  }

  function renderImpacts() {
    ctx.save();
    for (let i = state.impactRipples.length - 1; i >= 0; i--) {
      const rip = state.impactRipples[i];
      rip.radius += 1.4;
      rip.alpha -= 0.045;

      if (rip.alpha <= 0) {
        state.impactRipples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.strokeStyle = rip.color;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = Math.max(0, rip.alpha);
      ctx.stroke();

      // Secondary shockwave
      if (rip.radius > 8) {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function renderIXPNodes(timestamp) {
    ctx.save();
    const pulse = (Math.sin(timestamp * 0.005) + 1) / 2; // 0..1

    IXP_NODES.forEach((node) => {
      const pt = projector.project(node.lng, node.lat);
      const isHovered = state.hoveredNode && state.hoveredNode.code === node.code;

      // Outer glowing pulse ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7 + pulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? '#FFFFFF' : 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Core node dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHovered ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = isHovered ? 12 : 6;
      ctx.fill();

      // Node Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = isHovered ? '#00F0FF' : '#E2E8F0';
      ctx.font = 'bold 9px "Rajdhani", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`[${node.code}]`, pt.x + 8, pt.y - 2);

      // City sub-label
      ctx.fillStyle = '#94A3B8';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(node.city.toUpperCase(), pt.x + 8, pt.y + 7);

      // Target acquisition reticle for hovered defense node
      if (isHovered) {
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 1.2;
        const bSize = 10;
        ctx.beginPath();
        ctx.moveTo(pt.x - bSize, pt.y - bSize + 4);
        ctx.lineTo(pt.x - bSize, pt.y - bSize);
        ctx.lineTo(pt.x - bSize + 4, pt.y - bSize);

        ctx.moveTo(pt.x + bSize, pt.y - bSize + 4);
        ctx.lineTo(pt.x + bSize, pt.y - bSize);
        ctx.lineTo(pt.x + bSize - 4, pt.y - bSize);

        ctx.moveTo(pt.x - bSize, pt.y + bSize - 4);
        ctx.lineTo(pt.x - bSize, pt.y + bSize);
        ctx.lineTo(pt.x - bSize + 4, pt.y + bSize);

        ctx.moveTo(pt.x + bSize, pt.y + bSize - 4);
        ctx.lineTo(pt.x + bSize, pt.y + bSize);
        ctx.lineTo(pt.x + bSize - 4, pt.y + bSize);
        ctx.stroke();

        ctx.fillStyle = '#00F0FF';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText(`LOCKED // DEFENSE GATEWAY`, pt.x + 8, pt.y + 16);
      }
    });

    ctx.restore();
  }

  function renderCrosshairHUD() {
    if (!state.mousePos.x || !state.mousePos.y) return;
    const { x, y } = state.mousePos;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 30, 39, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);

    // Horizontal hair
    ctx.beginPath();
    ctx.moveTo(projector.padX, y);
    ctx.lineTo(projector.padX + projector.innerW, y);
    ctx.stroke();

    // Vertical hair
    ctx.beginPath();
    ctx.moveTo(x, projector.padY);
    ctx.lineTo(x, projector.padY + projector.innerH);
    ctx.stroke();

    ctx.restore();
  }

  // Military clocks for UTC and WIB
  function startTacticalClock() {
    const zuluEl = document.getElementById('clock-zulu');
    const wibEl = document.getElementById('clock-wib');

    function update() {
      const now = new Date();
      // UTC (Zulu)
      const zHours = String(now.getUTCHours()).padStart(2, '0');
      const zMins = String(now.getUTCMinutes()).padStart(2, '0');
      const zSecs = String(now.getUTCSeconds()).padStart(2, '0');
      if (zuluEl) zuluEl.textContent = `${zHours}:${zMins}:${zSecs}Z`;

      // WIB (UTC+7)
      const wibDate = new Date(now.getTime() + 7 * 3600 * 1000);
      const wHours = String(wibDate.getUTCHours()).padStart(2, '0');
      const wMins = String(wibDate.getUTCMinutes()).padStart(2, '0');
      const wSecs = String(wibDate.getUTCSeconds()).padStart(2, '0');
      if (wibEl) wibEl.textContent = `${wHours}:${wMins}:${wSecs} WIB`;
    }

    update();
    setInterval(update, 1000);
  }

  // UI population and table binding
  function populateSummaryUI(summary) {
    if (!summary) return;

    // KPI Badges
    const kpiShare = document.getElementById('kpi-ddos-share');
    const kpiIoc = document.getElementById('kpi-ioc-count');
    const kpiCompromised = document.getElementById('kpi-compromised');
    const kpiBandwidth = document.getElementById('kpi-bandwidth');

    if (kpiShare) kpiShare.textContent = `${summary.metrics.mitigated_ddos_share_id}%`;
    if (kpiIoc) kpiIoc.textContent = summary.metrics.active_ioc_count;
    if (kpiCompromised) kpiCompromised.textContent = summary.metrics.compromised_local_nodes;
    if (kpiBandwidth) kpiBandwidth.textContent = `${summary.metrics.peak_bps_index} Gbps`;

    // Top Attack Origins List
    const originsList = document.getElementById('top-origins-list');
    if (originsList && summary.top_attack_origins) {
      originsList.innerHTML = '';
      summary.top_attack_origins.forEach((item, idx) => {
        const pct = Math.round(item.share * 100);
        const li = document.createElement('div');
        li.className = 'tactical-bar-row mb-2';
        li.innerHTML = `
          <div class="flex justify-between text-xs mb-1 font-mono">
            <span class="text-slate-200"><span class="text-crimson-dim mr-1">0${idx + 1}.</span> [${item.country}] ${item.name}</span>
            <span class="text-crimson-hot font-bold">${item.count} <span class="text-slate-500">(${pct}%)</span></span>
          </div>
          <div class="w-full bg-[#1A0507] h-1.5 border border-[#450A0E]">
            <div class="bg-gradient-to-r from-[#88131B] to-[#FF1E27] h-full" style="width: ${pct}%"></div>
          </div>
        `;
        originsList.appendChild(li);
      });
    }

    // Attack Vectors Distribution
    const vectorsList = document.getElementById('attack-vectors-list');
    if (vectorsList && summary.attack_types) {
      vectorsList.innerHTML = '';
      summary.attack_types.forEach((item) => {
        const pct = Math.round(item.share * 100);
        const div = document.createElement('div');
        div.className = 'mb-2.5';
        div.innerHTML = `
          <div class="flex justify-between text-xs mb-1 font-mono">
            <span class="text-slate-300">${item.label}</span>
            <span class="text-amber-tactical font-semibold">${pct}%</span>
          </div>
          <div class="w-full bg-[#1A0507] h-1.5 border border-[#450A0E]">
            <div class="bg-gradient-to-r from-[#B45309] to-[#FF7A00] h-full" style="width: ${pct}%"></div>
          </div>
        `;
        vectorsList.appendChild(div);
      });
    }

    // Regional IXP Infrastructure Load
    const ixpContainer = document.getElementById('ixp-status-container');
    if (ixpContainer && summary.ixp_status) {
      ixpContainer.innerHTML = '';
      summary.ixp_status.forEach((node) => {
        const isHeavy = node.threat_pct > 70;
        const colorClass = isHeavy ? 'text-crimson-hot' : node.threat_pct > 40 ? 'text-amber-tactical' : 'text-emerald-400';
        const badgeBorder = isHeavy ? 'border-[#DC2626]' : 'border-[#450A0E]';
        const item = document.createElement('div');
        item.className = `p-1.5 bg-[#0D0304] border ${badgeBorder} flex items-center justify-between text-xs font-mono cursor-pointer hover:bg-[#1C0609] transition`;
        item.onclick = () => filterLogsByNode(node.code);
        item.innerHTML = `
          <div>
            <div class="font-bold text-slate-200">[${node.code}]</div>
            <div class="text-[10px] text-slate-500">${node.pps_k} kpps</div>
          </div>
          <div class="text-right">
            <div class="${colorClass} font-semibold">${node.threat_pct}%</div>
            <div class="text-[9px] text-slate-500">${node.status}</div>
          </div>
        `;
        ixpContainer.appendChild(item);
      });
    }

    // 24H Threat Trend Sparkline
    renderTrendChart(summary.trend_24h);
  }

  function renderTrendChart(trend) {
    const container = document.getElementById('trend-chart-container');
    if (!container || !trend) return;
    container.innerHTML = '';

    const maxVal = Math.max(...trend.map(t => t.intensity), 100);
    const chartDiv = document.createElement('div');
    chartDiv.className = 'flex items-end gap-1 h-20 w-full pt-2';

    trend.forEach((point) => {
      const heightPct = Math.round((point.intensity / maxVal) * 100);
      const isPeak = point.intensity > 85;
      const bar = document.createElement('div');
      bar.className = 'flex-1 group relative flex flex-col justify-end h-full';
      bar.innerHTML = `
        <div class="w-full ${isPeak ? 'bg-[#FF1E27]' : 'bg-[#7F1D1D]'} hover:bg-[#FF7A00] transition" style="height: ${heightPct}%"></div>
        <div class="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#060203] border border-[#DC2626] text-[9px] font-mono px-1 py-0.5 z-20 whitespace-nowrap text-white">
          ${point.hour} // ${point.intensity}%
        </div>
      `;
      chartDiv.appendChild(bar);
    });

    container.appendChild(chartDiv);
  }

  function populateEventsTable(events) {
    const tbody = document.getElementById('live-ioc-tbody');
    if (!tbody || !events) return;
    tbody.innerHTML = '';

    events.slice(0, 15).forEach((ev) => {
      const row = document.createElement('tr');
      row.className = 'border-b border-[#2B080B] hover:bg-[#1A0507] cursor-pointer transition text-xs font-mono';
      row.onclick = () => selectEvent(ev);

      const isCrit = ev.attack.severity === 'CRITICAL';
      const badgeClass = isCrit
        ? 'bg-[#450A0E] text-[#FF1E27] border border-[#DC2626]'
        : 'bg-[#451A03] text-[#FF7A00] border border-[#D97706]';

      const timeStr = ev.ts.split('T')[1].replace('Z', '');

      row.innerHTML = `
        <td class="py-1 px-2 text-slate-400">${timeStr}</td>
        <td class="py-1 px-2 font-bold text-slate-100">${ev.ip}</td>
        <td class="py-1 px-2 text-slate-300">[${ev.origin.country}] ${ev.origin.name.slice(0, 12)}</td>
        <td class="py-1 px-2 text-slate-400">${ev.asn}</td>
        <td class="py-1 px-2 text-cyan-400 font-semibold">[${ev.target.code}]</td>
        <td class="py-1 px-2"><span class="px-1.5 py-0.5 text-[10px] ${badgeClass}">${ev.attack.type}</span></td>
        <td class="py-1 px-2 font-bold ${isCrit ? 'text-red-500' : 'text-amber-500'}">${ev.attack.abuse_score}</td>
        <td class="py-1 px-2 text-right">
          <button class="px-1.5 py-0.5 bg-[#2B080B] hover:bg-[#FF1E27] text-slate-200 hover:text-black text-[10px] transition border border-[#450A0E]">
            INSPECT
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  function selectEvent(ev) {
    state.selectedEvent = ev;
    audio.playBlip(980, 0.05);

    // Update Right Panel: Packet Inspector
    const inspector = document.getElementById('packet-inspector-content');
    if (!inspector) return;

    const isCrit = ev.attack.severity === 'CRITICAL';
    const isDomestic = ev.origin.country === 'ID';

    inspector.innerHTML = `
      <div class="text-xs font-mono space-y-2">
        <div class="flex justify-between items-center border-b border-[#450A0E] pb-1">
          <span class="text-slate-400">EVENT ID:</span>
          <span class="font-bold text-crimson-hot">${ev.id}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">TIMESTAMP:</span>
          <span class="text-slate-200">${ev.ts}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">THREAT ACTOR IP:</span>
          <span class="font-bold text-white bg-[#22070A] px-1 border border-[#DC2626]">${ev.ip}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">ASN / OPERATOR:</span>
          <span class="text-slate-300">${ev.asn} (${ev.org})</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">GEODESIC ORIGIN:</span>
          <span class="${isDomestic ? 'text-cyan-400 font-bold' : 'text-slate-200'}">
            ${isDomestic ? '⚠ DOMESTIC COMPROMISED' : `[${ev.origin.country}] ${ev.origin.name}`}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">PERIMETER VECTOR:</span>
          <span class="text-amber-tactical">${ev.perimeter_entry ? ev.perimeter_entry.sector : 'N/A'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">TARGET GATEWAY:</span>
          <span class="text-cyan-400 font-bold">${ev.target.city} [${ev.target.code}]</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">VECTOR / PROTOCOL:</span>
          <span class="${isCrit ? 'text-crimson-primary font-bold' : 'text-amber-tactical'}">${ev.attack.label} (${ev.attack.protocol})</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">CONFIDENCE SCORE:</span>
          <span class="text-red-400 font-bold">${ev.attack.abuse_score} / 100</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">INTEL SOURCE:</span>
          <span class="text-slate-500">${ev.source}</span>
        </div>

        <div class="mt-3 pt-2 border-t border-[#450A0E]">
          <div class="text-[10px] text-slate-500 mb-1">TELEMETRY HEX INSPECTION:</div>
          <pre class="bg-[#050102] p-2 border border-[#2B080B] text-[10px] text-crimson-dim font-mono overflow-x-auto">45 00 00 3c 1a 2b 40 00 40 06 c3 11 ${ev.ip.split('.').map(x => Number(x).toString(16).padStart(2, '0')).join(' ')} 00 50 1a f4 ... [SYN ACK ACK]</pre>
        </div>

        <div class="pt-2 flex gap-2">
          <button onclick="copyToClipboard('${ev.ip}', this)" class="flex-1 py-1.5 bg-[#450A0E] hover:bg-[#FF1E27] text-white text-xs font-mono font-bold transition border border-[#DC2626]">
            COPY IP
          </button>
          <button onclick="copyMikrotikRule('${ev.ip}', '${ev.attack.type}', this)" class="flex-1 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-cyan-400 text-xs font-mono font-bold transition border border-cyan-800">
            MIKROTIK RULE
          </button>
        </div>
      </div>
    `;

    // Highlight attack laser on canvas immediately
    spawnAttackLaser(ev);
  }

  function filterLogsByNode(nodeCode) {
    const filtered = state.events.filter(e => e.target.code === nodeCode);
    populateEventsTable(filtered.length ? filtered : state.events);
    const filterTag = document.getElementById('table-filter-tag');
    if (filterTag) filterTag.textContent = `FILTER: ${nodeCode} (${filtered.length} hits)`;
  }

  window.resetTableFilter = function () {
    populateEventsTable(state.events);
    const filterTag = document.getElementById('table-filter-tag');
    if (filterTag) filterTag.textContent = `ALL TELEMETRY (${state.events.length} hits)`;
  };

  // Blocklist export handlers
  window.copyToClipboard = function (text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      audio.playBlip(1400, 0.05);
      const originalText = btn.textContent;
      btn.textContent = 'COPIED!';
      setTimeout(() => { btn.textContent = originalText; }, 1400);
    });
  };

  window.copyMikrotikRule = function (ip, attackType, btn) {
    const cmd = `/ip firewall address-list add list=GARUDA_SENTINEL address=${ip} comment="GS-${attackType}" timeout=1d`;
    navigator.clipboard.writeText(cmd).then(() => {
      audio.playBlip(1400, 0.05);
      const originalText = btn.textContent;
      btn.textContent = 'RULE COPIED!';
      setTimeout(() => { btn.textContent = originalText; }, 1400);
    });
  };

  window.downloadBlocklist = function (format) {
    audio.playBlip(1100, 0.08);
    let filename, mimeType, content;

    const uniqueIps = Array.from(new Set(state.events.map(e => e.ip)));

    if (format === 'txt') {
      filename = 'garuda-sentinel-blocklist.txt';
      mimeType = 'text/plain';
      content = `# Garuda Sentinel Threat Watch Blocklist\n# Generated: ${new Date().toISOString()}\n\n` + uniqueIps.join('\n');
    } else if (format === 'csv') {
      filename = 'garuda-sentinel-blocklist.csv';
      mimeType = 'text/csv';
      content = 'ip,asn,org,country,attack_type,target_ixp\n' + state.events.map(e =>
        `"${e.ip}","${e.asn}","${e.org}","${e.origin.country}","${e.attack.type}","${e.target.code}"`
      ).join('\n');
    } else if (format === 'rsc') {
      filename = 'garuda-sentinel-mikrotik.rsc';
      mimeType = 'text/plain';
      content = `/ip firewall address-list\n` + state.events.map(e =>
        `add list=GARUDA_SENTINEL address=${e.ip} timeout=1d comment="GS-${e.origin.country}-${e.attack.type}"`
      ).join('\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Initial data load
  async function loadInitialData() {
    try {
      // 1. Fetch GeoJSON
      const geoResp = await fetch('./assets/id-archipelago.geojson');
      if (geoResp.ok) {
        state.geoJson = await geoResp.json();
        rebuildCachedPolygons();
      }

      // 2. Fetch Summary JSON (try ./data/summary.json then fallback ../data/)
      let sumResp = await fetch('./data/summary.json');
      if (!sumResp.ok) sumResp = await fetch('../data/summary.json');
      if (sumResp.ok) {
        state.summary = await sumResp.json();
        populateSummaryUI(state.summary);
      }

      // 3. Fetch Events JSON
      let evResp = await fetch('./data/events.json');
      if (!evResp.ok) evResp = await fetch('../data/events.json');
      if (evResp.ok) {
        state.events = await evResp.json();
        populateEventsTable(state.events);
        if (state.events.length > 0) {
          selectEvent(state.events[0]);
        }
      }

      const syncStatus = document.getElementById('bottom-sync-status');
      if (syncStatus) syncStatus.textContent = 'STATUS: INTEL FEED SYNCHRONIZED';

    } catch (e) {
      console.error('[!] Failed to load telemetry data:', e);
      const syncStatus = document.getElementById('bottom-sync-status');
      if (syncStatus) syncStatus.textContent = 'STATUS: OFFLINE CACHE ACTIVE';
    }
  }

  // Global control handlers
  window.switchSidebarView = function (viewId) {
    audio.playBlip(1250, 0.05);
    const navButtons = ['radar', 'telemetry', 'nodes', 'blocklist', 'osint'];
    navButtons.forEach((id) => {
      const btn = document.getElementById(`nav-${id}`);
      if (btn) {
        if (id === viewId) {
          btn.classList.add('nav-btn-active');
          btn.classList.remove('text-slate-400');
          btn.classList.add('text-white');
        } else {
          btn.classList.remove('nav-btn-active');
          btn.classList.add('text-slate-400');
          btn.classList.remove('text-white');
        }
      }
    });

    if (viewId === 'radar') {
      window.resetTableFilter();
    } else if (viewId === 'telemetry') {
      const criticalOnly = state.events.filter(e => e.attack.severity === 'CRITICAL');
      populateEventsTable(criticalOnly);
      const tag = document.getElementById('table-filter-tag');
      if (tag) tag.textContent = `CRITICAL SIGINT (${criticalOnly.length} hits)`;
    } else if (viewId === 'nodes') {
      filterLogsByNode('JKT-IXP');
    } else if (viewId === 'blocklist') {
      const generatorEl = document.querySelector('button[onclick*="downloadBlocklist"]');
      if (generatorEl) generatorEl.focus();
    } else if (viewId === 'osint') {
      const osintEvents = state.events.filter(e => e.source.includes('abuse.ch') || e.source.includes('DShield'));
      populateEventsTable(osintEvents);
      const tag = document.getElementById('table-filter-tag');
      if (tag) tag.textContent = `OSINT CORRELATED (${osintEvents.length} hits)`;
    }
  };

  window.toggleFullscreen = function () {
    audio.playBlip(1400, 0.06);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  window.toggleAudio = function () {
    const isEnabled = audio.toggle();
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) {
      btn.innerHTML = isEnabled
        ? '<span class="text-emerald-400">🔊 AUDIO ON</span>'
        : '<span class="text-slate-400">🔇 AUDIO OFF</span>';
    }
  };

  window.toggleSimulationPause = function () {
    state.isPaused = !state.isPaused;
    const btn = document.getElementById('btn-pause-sim');
    if (btn) {
      btn.textContent = state.isPaused ? '▶ RESUME' : '⏸ PAUSE';
      btn.className = state.isPaused
        ? 'px-2 py-0.5 bg-emerald-950 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold'
        : 'px-2 py-0.5 bg-[#2B080B] border border-[#DC2626] text-slate-200 text-xs font-mono';
    }
  };

  window.setSpeedMultiplier = function (mult) {
    state.speedMultiplier = mult;
    ['1', '2', '5'].forEach((m) => {
      const b = document.getElementById(`btn-speed-${m}`);
      if (b) {
        if (Number(m) === mult) {
          b.className = 'px-2 py-0.5 bg-[#FF1E27] text-white font-bold text-xs font-mono';
        } else {
          b.className = 'px-2 py-0.5 bg-[#140406] text-slate-400 hover:text-white text-xs font-mono border border-[#450A0E]';
        }
      }
    });
  };

  // Bootstrap initialization
  window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    startTacticalClock();
    loadInitialData();
    requestAnimationFrame(renderCanvas);
  });

})();

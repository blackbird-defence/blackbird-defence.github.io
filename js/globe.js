/**
 * Interactive 3D Globe rendered on Canvas2D.
 * Port of the Flutter GlobePainter / GlobeMath implementation.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ─── State ───
  let countries = null;
  let rotationX = 0.3;
  let rotationY = 0.0;
  let zoom = 1.0;
  let isDragging = false;
  let lastPointer = null;
  let autoRotateTimer = null;
  const AUTO_ROTATE_SPEED = 0.003;

  // HUD elements
  const hudLat = document.getElementById('hudLat');
  const hudLon = document.getElementById('hudLon');
  const hudZoom = document.getElementById('hudZoom');

  // ─── Math (from globe_math.dart) ───
  const DEG2RAD = Math.PI / 180;

  function latLonToCartesian(latDeg, lonDeg) {
    const lat = latDeg * DEG2RAD;
    const lon = lonDeg * DEG2RAD;
    const cosLat = Math.cos(lat);
    return [cosLat * Math.sin(lon), Math.sin(lat), cosLat * Math.cos(lon)];
  }

  function rotatePoint(x, y, z, rotX, rotY) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    return [x1, y1, z2];
  }

  function projectToScreen(x, y, radius, cx, cy) {
    return [x * radius + cx, -y * radius + cy];
  }

  function transformPoint(latDeg, lonDeg, radius, cx, cy) {
    let [x, y, z] = latLonToCartesian(latDeg, lonDeg);
    [x, y, z] = rotatePoint(x, y, z, rotationX, rotationY);
    const origZ = z;

    // Clamp to horizon
    if (z < 0) {
      const len = Math.sqrt(x * x + y * y);
      if (len > 1e-10) { x /= len; y /= len; }
      else { x = 1; y = 0; }
      z = 0;
    }

    const [sx, sy] = projectToScreen(x, y, radius, cx, cy);
    return { sx, sy, z: origZ };
  }

  // ─── Data Loading ───
  function loadCountries() {
    try {
      const geojson = window.GLOBE_DATA;
      if (!geojson) { console.error('GLOBE_DATA not found'); return; }
      countries = [];

      for (const feature of geojson.features) {
        const props = feature.properties || {};
        const name = props.name || '';
        const geometry = feature.geometry;
        if (!geometry) continue;

        let multiPolygon;
        if (geometry.type === 'Polygon') {
          multiPolygon = [geometry.coordinates];
        } else if (geometry.type === 'MultiPolygon') {
          multiPolygon = geometry.coordinates;
        } else {
          continue;
        }

        // Calculate centroid
        let sumLat = 0, sumLon = 0, count = 0;
        for (const polygon of multiPolygon) {
          if (!polygon.length) continue;
          const ring = polygon[0];
          for (const pt of ring) {
            sumLon += pt[0];
            sumLat += pt[1];
            count++;
          }
        }
        if (count === 0) continue;

        countries.push({
          name,
          polygons: multiPolygon,
          centroidLat: sumLat / count,
          centroidLon: sumLon / count,
        });
      }
    } catch (e) {
      console.error('Failed to load globe data:', e);
    }
  }

  // ─── Canvas Sizing ───
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ─── Drawing ───
  function draw() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) / 2 - 30;
    const radius = baseRadius * zoom;

    ctx.clearRect(0, 0, w, h);

    // Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 1.4);
    glowGrad.addColorStop(0, 'rgba(74, 222, 128, 0.10)');
    glowGrad.addColorStop(0.6, 'rgba(74, 222, 128, 0.04)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Clip to sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Ocean
    ctx.fillStyle = '#0E2A1E';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Grid lines
    drawGridLines(ctx, cx, cy, radius);

    // Countries
    if (countries) {
      drawCountries(ctx, cx, cy, radius);
    }

    ctx.restore();

    // Rim
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Country labels (only when zoomed)
    if (countries && zoom > 1.5) {
      drawCountryLabels(ctx, cx, cy, radius);
    }

    // Update HUD
    updateHUD();
  }

  function drawGridLines(ctx, cx, cy, radius) {
    ctx.strokeStyle = 'rgba(26, 58, 42, 0.35)';
    ctx.lineWidth = 0.5;

    // Latitude
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 3) {
        const { sx, sy, z } = transformPoint(lat, lon, radius, cx, cy);
        if (z > -0.1) {
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Longitude
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -90; lat <= 90; lat += 3) {
        const { sx, sy, z } = transformPoint(lat, lon, radius, cx, cy);
        if (z > -0.1) {
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
  }

  function drawCountries(ctx, cx, cy, radius) {
    ctx.fillStyle = '#15402A';
    ctx.strokeStyle = '#3A7D55';
    ctx.lineWidth = 0.6;
    ctx.lineJoin = 'round';

    for (const country of countries) {
      // Quick visibility check
      const centroid = transformPoint(country.centroidLat, country.centroidLon, radius, cx, cy);
      if (centroid.z < -0.3) continue;

      for (const polygon of country.polygons) {
        if (!polygon.length) continue;
        const ring = polygon[0];
        if (ring.length < 3) continue;

        const path = buildPolygonPath(ring, cx, cy, radius);
        if (path) {
          ctx.fill(path);
          ctx.stroke(path);
        }
      }
    }
  }

  function buildPolygonPath(ring, cx, cy, radius) {
    let anyVisible = false;
    const points = [];

    for (const coord of ring) {
      const lon = coord[0];
      const lat = coord[1];

      let [x, y, z] = latLonToCartesian(lat, lon);
      [x, y, z] = rotatePoint(x, y, z, rotationX, rotationY);

      if (z > 0) anyVisible = true;

      // Clamp behind-sphere points to horizon
      if (z < 0) {
        const len = Math.sqrt(x * x + y * y);
        if (len > 1e-10) { x /= len; y /= len; }
        z = 0;
      }

      const [sx, sy] = projectToScreen(x, y, radius, cx, cy);
      points.push([sx, sy]);
    }

    if (!anyVisible || points.length < 3) return null;

    const path = new Path2D();
    path.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0], points[i][1]);
    }
    path.closePath();
    return path;
  }

  function drawCountryLabels(ctx, cx, cy, radius) {
    const fontSize = Math.min(12, 2.0 * (zoom - 1.0));
    if (fontSize < 1.5) return;
    const alpha = Math.min(1, (fontSize - 1.5) / 4.0);

    ctx.font = `600 ${fontSize}px 'Courier New'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const country of countries) {
      if (!country.name) continue;
      const { sx, sy, z } = transformPoint(country.centroidLat, country.centroidLon, radius, cx, cy);
      if (z < 0.3) continue;

      const dist = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
      if (dist > radius * 0.85) continue;

      ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.9})`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(country.name.toUpperCase(), sx, sy);
      ctx.shadowBlur = 0;
    }
  }

  function updateHUD() {
    // Convert rotation to approximate lat/lon for display
    const latDeg = (rotationX * 180 / Math.PI).toFixed(1);
    const lonDeg = ((rotationY * 180 / Math.PI) % 360).toFixed(1);
    if (hudLat) hudLat.textContent = latDeg + '\u00B0';
    if (hudLon) hudLon.textContent = lonDeg + '\u00B0';
    if (hudZoom) hudZoom.textContent = zoom.toFixed(1) + 'x';
  }

  // ─── Interaction ───
  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    isDragging = true;
    lastPointer = getPointerPos(e);
    clearTimeout(autoRotateTimer);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging || !lastPointer) return;
    const pos = getPointerPos(e);
    const dx = pos.x - lastPointer.x;
    const dy = pos.y - lastPointer.y;
    rotationY += dx * 0.005;
    rotationX += dy * 0.005;
    rotationX = Math.max(-1.4, Math.min(1.4, rotationX));
    lastPointer = pos;
    e.preventDefault();
  }

  function onPointerUp() {
    isDragging = false;
    lastPointer = null;
    autoRotateTimer = setTimeout(() => {}, 2000);
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    zoom = Math.max(1.0, Math.min(7.0, zoom + delta));
  }

  // Mouse events
  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Touch events
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp);

  // Scroll zoom
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ─── Animation Loop ───
  function animate() {
    if (!isDragging) {
      rotationY += AUTO_ROTATE_SPEED;
    }
    draw();
    requestAnimationFrame(animate);
  }

  // ─── Init ───
  function init() {
    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
    });
    loadCountries();
    animate();
  }

  // Start when globe section is near viewport (lazy load)
  const globeSection = document.getElementById('globe');
  if (globeSection) {
    const initObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        init();
        initObserver.disconnect();
      }
    }, { rootMargin: '200px' });
    initObserver.observe(globeSection);
  } else {
    init();
  }
})();

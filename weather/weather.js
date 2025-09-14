/* Global Rain Radar
 * - Leaflet + RainViewer API
 * - Dark basemap
 * - Timeline + legend that matches RainViewer colour scheme
 * - Prominent timestamp (local + UTC + "x min ago")
 */

(function () {
  // ---------- UI elements
  const statusEl = document.getElementById('status');
  const tsEl = document.getElementById('timestamp');
  const slider = document.getElementById('slider');
  const frameLabel = document.getElementById('frameLabel');
  const btnPlay = document.getElementById('btnPlay');
  const btnBack = document.getElementById('btnBack');
  const btnFwd  = document.getElementById('btnFwd');

  const showStatus = (msg, ms=3000) => {
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
    if (ms) setTimeout(()=>{ statusEl.style.display='none'; }, ms);
  };

  // ---------- Map + basemaps
  const map = L.map('map', { minZoom: 2, worldCopyJump: true });
  map.setView([20, 0], 3); // global view

  const esriDark = L.tileLayer(
    'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors' }
  ).addTo(map);

  const osmStd = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' });

  const baseMaps = { 'Esri Dark Gray': esriDark, 'OSM Standard': osmStd };
  const overlayMaps = {};
  const layerCtrl = L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);

  L.control.scale({ metric: true, imperial: true }).addTo(map);

  // ---------- RainViewer palette & legend
  // We’ll use RainViewer colour scheme 3 (blue→green→yellow→orange→red→magenta),
  // which matches what you see on their tiles.
  const COLOR_SCHEME = 3;   // 0..3 (this legend matches 3)
  const TILE_SIZE    = (window.devicePixelRatio > 1) ? 512 : 256;
  const SMOOTH       = 1;   // 0 off, 1 on
  const BRIGHTNESS   = 1;   // intensity multiplier

  // Approximate segment colours for scheme 3 (low→high). These align visually with RainViewer.
  const RV3_COLORS = [
    '#77aaff', // light blue (very light)
    '#3f7fff', // blue (light)
    '#00c853', // green (moderate)
    '#ffd600', // yellow (heavy)
    '#ff9100', // orange (very heavy)
    '#ff1744', // red (intense)
    '#ff00b8'  // magenta (extreme)
  ];
  const RV3_LABELS = ['Very light','Light','Moderate','Heavy','Very heavy','Intense','Extreme'];

  // Legend control with gradient + swatches generated from the active palette
  const LegendControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'leaflet-control legend');
      div.innerHTML = `
        <h4>Radar intensity</h4>
        <div class="gradient" id="legendGradient"></div>
        <div class="scale"><span>Low</span><span>High</span></div>
        <div class="swatches" id="legendSwatches"></div>
      `;
      return div;
    }
  });
  const legend = new LegendControl();
  map.addControl(legend);

  function buildLegend(colors, labels) {
    const grad = document.getElementById('legendGradient');
    const sw = document.getElementById('legendSwatches');
    if (grad) grad.style.background = `linear-gradient(to right, ${colors.join(',')})`;
    if (sw) {
      sw.innerHTML = '';
      const steps = Math.min(colors.length, labels.length);
      for (let i=0;i<steps;i++){
        const box = document.createElement('div');
        box.className = 'swatch';
        box.style.background = colors[i];
        box.title = labels[i];
        sw.appendChild(box);
      }
    }
  }
  buildLegend(RV3_COLORS, RV3_LABELS);

  // ---------- RainViewer timeline
  const API = 'https://api.rainviewer.com/public/weather-maps.json';
  let frames = [];       // frame metadata
  let frameIndex = 0;    // current frame
  let playing = false;
  let animTimer = null;

  const radarLayer = L.tileLayer('', { opacity: 0.65, attribution: 'Radar © RainViewer' });

  function tileUrl(host, path) {
    // host + path + /{tileSize}/{z}/{x}/{y}/{colorScheme}/{smooth}_{brightness}.png
    return `${host}${path}/${TILE_SIZE}/{z}/{x}/{y}/${COLOR_SCHEME}/${SMOOTH}_${BRIGHTNESS}.png`;
  }

  function formatFrameTime(unixSeconds) {
    const dLocal = new Date(unixSeconds * 1000);
    const dUTC = new Date(dLocal.getTime() + dLocal.getTimezoneOffset()*60000);
    const now = new Date();
    const minsAgo = Math.round((now - dLocal) / 60000);
    const ago = minsAgo === 0 ? 'just now' : `${minsAgo} min ago`;
    const localStr = dLocal.toLocaleString('en-GB', { hour12: false });
    const utcStr   = dUTC.toUTCString().replace(' GMT','');
    return { label: `${localStr} (local) • ${utcStr} • ${ago}`, localStr };
  }

  function updateTimestamp(unixSeconds) {
    if (!tsEl) return;
    const { label, localStr } = formatFrameTime(unixSeconds);
    tsEl.textContent = label;
    document.title = `Global Rain Radar — ${localStr}`;
  }

  function updateFrameLabel() {
    frameLabel.textContent = `Frame ${frameIndex + 1}/${frames.length}`;
  }

  function showFrame(i) {
    if (!frames.length) return;
    frameIndex = Math.max(0, Math.min(i, frames.length - 1));
    const f = frames[frameIndex];
    radarLayer.setUrl(tileUrl(f.host, f.path));
    updateTimestamp(f.time);
    slider.value = String(frameIndex);
    updateFrameLabel();
  }

  function step(delta) {
    let i = frameIndex + delta;
    if (i >= frames.length) i = 0;
    if (i < 0) i = frames.length - 1;
    showFrame(i);
  }

  function play() {
    if (playing || !frames.length) return;
    playing = true;
    btnPlay.textContent = '❚❚';
    animTimer = setInterval(() => step(1), 600);
  }
  function pause() {
    playing = false;
    btnPlay.textContent = '▶';
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
  }
  function togglePlay() { playing ? pause() : play(); }

  // Wire controls
  btnPlay.addEventListener('click', togglePlay);
  btnBack.addEventListener('click', () => { pause(); step(-1); });
  btnFwd .addEventListener('click', () => { pause(); step(+1); });
  slider .addEventListener('input', (e) => { pause(); showFrame(parseInt(e.target.value, 10)); });

  // Load frames
  async function loadRadar() {
    showStatus('Loading rain radar…', 1200);
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(`RainViewer ${res.status}`);
      const cfg = await res.json();

      const past = (cfg.radar && cfg.radar.past) || [];
      const nowc = (cfg.radar && cfg.radar.nowcast) || [];
      if (!past.length && !nowc.length) {
        showStatus('No radar frames available right now.');
        return;
      }
      frames = [...past, ...nowc].map(f => ({ ...f, host: cfg.host }));
      slider.max = String(frames.length - 1);
      slider.value = String(frames.length - 1);
      frameIndex = frames.length - 1;

      if (!map.hasLayer(radarLayer)) {
        radarLayer.addTo(map);
        layerCtrl.addOverlay(radarLayer, 'Rain Radar (RainViewer)');
      }

      showFrame(frameIndex);
    } catch (err) {
      console.error(err);
      showStatus('Could not load RainViewer (network/CORS). Try again later.');
    }
  }

  loadRadar();
  setInterval(loadRadar, 5 * 60 * 1000);
})();

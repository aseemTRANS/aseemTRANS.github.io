/* UK Rain Radar professional viewer
 * - Leaflet + RainViewer API (public)
 * - Esri World Dark Gray basemap
 * - Timeline: play/pause, step, slider
 * - Timestamp label, legend, scale bar
 * - Graceful errors
 */

(function () {
  // ---- Elements
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

  // ---- Map
  const map = L.map('map', { minZoom: 4, worldCopyJump: true });
  map.setView([54.5, -2.5], 6); // UK centroid

  // Esri World Dark Gray basemap
  const esriDark = L.tileLayer(
    'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution:
        'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors'
    }
  ).addTo(map);

  // Optional: alternate basemap (OSM Standard)
  const osmStd = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
  );

  // Layer control seed
  const baseMaps = { 'Esri Dark Gray': esriDark, 'OSM Standard': osmStd };
  const overlayMaps = {};
  const layerCtrl = L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);

  // Scale bar
  L.control.scale({ metric: true, imperial: false }).addTo(map);

  // ---- Legend (RainViewer default colour scheme approximation)
  const LegendControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'leaflet-control legend');
      div.innerHTML = `
        <h4>Radar intensity</h4>
        <div class="row"><span class="swatch" style="background:#9be7ff"></span> Light</div>
        <div class="row"><span class="swatch" style="background:#52c7ff"></span> Moderate</div>
        <div class="row"><span class="swatch" style="background:#1e90ff"></span> Heavy</div>
        <div class="row"><span class="swatch" style="background:#0048ff"></span> Very heavy</div>
        <div class="row"><span class="swatch" style="background:#8000ff"></span> Intense</div>
        <div class="row"><span class="swatch" style="background:#ff00a8"></span> Extreme</div>
        <div class="muted">Source: RainViewer</div>
      `;
      return div;
    }
  });
  map.addControl(new LegendControl());

  // ---- RainViewer logic
  const API = 'https://api.rainviewer.com/public/weather-maps.json';
  let frames = [];       // Array of frame metadata (past + nowcast)
  let frameIndex = 0;    // Current frame index
  let playing = false;
  let animTimer = null;

  // Use 256 tile size; switch to 512 on HiDPI if you prefer
  const TILE_SIZE = (window.devicePixelRatio > 1) ? 512 : 256;
  const COLOR_SCHEME = 2; // 0..3 schemes in RainViewer
  const SMOOTH = 1;       // 0 off, 1 on
  const BRIGHTNESS = 1;   // 0..1..n multiplicative (keep 1)

  // Build tile template from a frame object
  const tileUrl = (host, path) => `${host}${path}/${TILE_SIZE}/{z}/{x}/{y}/${COLOR_SCHEME}/${SMOOTH}_${BRIGHTNESS}.png`;

  // Single tile layer we will retarget via setUrl()
  const radarLayer = L.tileLayer('', { opacity: 0.65, attribution: 'Radar © RainViewer' });

  function updateTimestamp(unixSeconds) {
    if (!tsEl) return;
    const d = new Date((unixSeconds || 0) * 1000);
    tsEl.textContent = isNaN(d) ? '—' : d.toLocaleString('en-GB', { hour12: false });
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
    animTimer = setInterval(() => step(1), 600); // speed
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
  btnFwd.addEventListener('click',  () => { pause(); step(+1); });
  slider.addEventListener('input',  (e) => { pause(); showFrame(parseInt(e.target.value, 10)); });

  // Load RainViewer configuration
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
      // Build a single ordered list: past then nowcast
      const all = [...past, ...nowc].map(f => ({ ...f, host: cfg.host }));
      frames = all;
      slider.max = String(frames.length - 1);
      slider.value = String(frames.length - 1); // show latest by default
      frameIndex = frames.length - 1;

      // Add radar layer to map & layer control
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

  // Initial load & periodic refresh (every 5 minutes)
  loadRadar();
  setInterval(loadRadar, 5 * 60 * 1000);
})();

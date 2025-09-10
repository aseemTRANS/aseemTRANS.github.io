(function () {
  // Utility: status banner
  const statusEl = document.getElementById('status');
  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
  }
  function clearStatus() {
    if (!statusEl) return;
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }

  // Init map after Leaflet loads
  window.addEventListener('DOMContentLoaded', () => {
    // 1) Base map
    const map = L.map('map', {
      minZoom: 3,
      worldCopyJump: true
    }).setView([38, -95], 4);

    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
      }
    ).addTo(map);

    // 2) NEXRAD radar (WMS)
    // Uses Iowa State Mesonet WMS; HTTPS + transparent PNG; works well with Leaflet.
    // If radar seems blank, there may be no active precip—zoom/scan or check later.
    const radar = L.tileLayer.wms(
      'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
      {
        layers: 'nexrad-n0r-900913',
        format: 'image/png',
        transparent: true,
        opacity: 0.7
      }
    ).addTo(map);

    // 3) Active weather alerts (GeoJSON) from NWS
    // The NWS API supports CORS. We use fetch with graceful error handling.
    const alertsUrl = 'https://api.weather.gov/alerts/active?region_type=land';

    showStatus('Loading active weather alerts…');
    fetch(alertsUrl, {
      // The browser sets an acceptable User-Agent; no custom headers needed for CORS.
      // Keep it simple to avoid triggering preflight issues.
      method: 'GET',
      cache: 'no-store'
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`NWS ${res.status}`);
        // NWS returns GeoJSON FeatureCollection
        return await res.json();
      })
      .then((geojson) => {
        clearStatus();
        if (!geojson || !geojson.features || !geojson.features.length) {
          showStatus('No active alerts at the moment.');
          setTimeout(clearStatus, 4000);
          return;
        }

        // Severity → color mapping
        const sevColor = (sev) => {
          switch ((sev || '').toLowerCase()) {
            case 'extreme': return '#7e0023'; // deep red
            case 'severe':  return '#d73027'; // red
            case 'moderate':return '#fc8d59'; // orange
            case 'minor':   return '#fee08b'; // yellow
            default:        return '#74add1'; // blue/other
          }
        };

        const alertsLayer = L.geoJSON(geojson, {
          style: (f) => ({
            color: sevColor(f.properties?.severity),
            weight: 2,
            fill: true,
            fillOpacity: 0.15
          }),
          onEachFeature: (feature, layer) => {
            const p = feature.properties || {};
            const title = p.event || p.headline || 'Weather Alert';
            const area = p.areaDesc ? `<div><strong>Area:</strong> ${p.areaDesc}</div>` : '';
            const when =
              (p.effective ? `<div><strong>Effective:</strong> ${new Date(p.effective).toLocaleString()}</div>` : '') +
              (p.ends ? `<div><strong>Ends:</strong> ${new Date(p.ends).toLocaleString()}</div>` : '');
            const desc = p.description ? `<p>${p.description.replace(/\n+/g, '<br>')}</p>` : '';
            const html = `<h4>${title}</h4>${area}${when}${desc}`;
            layer.bindPopup(html, { maxWidth: 360 });
          }
        }).addTo(map);

        // 4) Layer control
        L.control.layers(
          { 'OpenStreetMap': osm },
          { 'NEXRAD Radar': radar, 'NWS Alerts': alertsLayer },
          { collapsed: false }
        ).addTo(map);
      })
      .catch((err) => {
        console.error(err);
        showStatus('Could not load NWS alerts (network/CORS). Radar & basemap still work.');
      });
  });
})();

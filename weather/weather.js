// 1) Base map
var map = L.map('map').setView([38, -95], 4);
var basemapUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
L.tileLayer(basemapUrl).addTo(map);

// 2) Radar (WMS)
var radarUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi';
var radar = L.tileLayer.wms(radarUrl, {
  layers: 'nexrad-n0r-900913',
  format: 'image/png',
  transparent: true
}).addTo(map);

// 3) Alerts (GeoJSON via NWS API)
var weatherAlertsUrl = 'https://api.weather.gov/alerts/active?region_type=land';
$.getJSON(weatherAlertsUrl, function(data) {
  L.geoJSON(data, {
    style: function(feature) {
      var c = 'orange';
      if (feature.properties.severity === 'Severe') c = 'red';
      return { color: c };
    },
    onEachFeature: function(feature, layer) {
      layer.bindPopup(feature.properties.headline);
    }
  }).addTo(map);
});

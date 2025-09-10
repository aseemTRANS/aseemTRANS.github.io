## UK Rain Radar (Leaflet + RainViewer)

A lightweight, static web app that visualises live rain radar over the UK (~around the world) using RainViewer tiles on a dark basemap. Built with vanilla HTML/CSS/JS and Leaflet. No build step, deployable with GitHub Pages.

Live demo: https://aseemtrans.github.io/weather/

## Features

🌧️ Live radar from RainViewer (past + nowcast frames)
▶️ Timeline controls: play/pause, step, slider
🕒 Timestamp of the displayed frame (local time)
🗺️ Basemap: Esri World Dark Gray (with optional OSM toggle)
📏 Legend for radar intensity + scale bar
♿ Accessible labels and ARIA live regions
⚠️ Graceful error handling (network/CORS)


## Tech stack

* Leaflet 1.9.x
* RainViewer public tiles (https://api.rainviewer.com/public/weather-maps.json)
* Esri World Dark Gray Base tiles
* Vanilla HTML/CSS/JS (no bundler, no framework)


## How it works (RainViewer timeline)

* On load, the app fetches:
https://api.rainviewer.com/public/weather-maps.json

* It concatenates radar.past + radar.nowcast frames and builds a single timeline.

* Each frame supplies a {host} and {path} used to construct a Leaflet tile URL:
{host}{path}/{tileSize}/{z}/{x}/{y}/{colorScheme}/{smooth}_{brightness}.png

* The app updates a single L.tileLayer via setUrl(...) when stepping through frames.

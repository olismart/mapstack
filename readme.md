# About Mapstack

Mapstack is a minimalist, mobile-first mapping web app for planning trips, exploring places, and combining route data on an interactive map. It brings route planning, place search, and multi-layer GeoJSON, GPX, and Komoot Tour imports into a single lightweight interface.

The app is built around a full-screen OpenStreetMap map with a small set of focused actions: **Search**, **New Route**, and **Import**. It is designed to work well on phones as well as desktop browsers, with accessible dialogs, keyboard-friendly controls, and live geolocation.

## Features

### Route planning

- Create routes with multiple stops for cycling, walking, or driving.
- Find stops with place suggestions or fill a stop with the device's current location.
- Calculate routes with OSRM and display their geometry, distance, and estimated duration.
- Fit the map to the complete route after it is created.

### Route and layer import

- Import `.gpx`, `.geojson`, and `.json` files up to 25 MB.
- Convert GPX tracks, routes, and waypoints to GeoJSON in the browser, preserving available elevation, names, notes, distance, and duration information.
- Display classified GPX waypoints with distinct markers and interactive popups.
- Import a shared Komoot Tour by pasting its link; no Komoot login or credentials are required.

### Search and discovery

- Search for named places with OpenStreetMap Nominatim.
- Search for categories such as cafes, campsites, shops, drinking water, and viewpoints within the current map viewport using Postpass.
- Add category results as a map layer and refresh that layer after moving the map.

### Layer management

- Stack multiple color-coded GeoJSON layers on the same map.
- Focus, rename, show or hide, and delete layers from floating layer cards.
- Keep layers between page reloads using browser `localStorage`.
- View live device location with a dedicated location marker.

## How it works

Mapstack's interface and most data processing run in the browser. Uploaded GPX and GeoJSON files are parsed locally, and map layers are stored in the current browser rather than in a Mapstack account or database. Clearing the browser's site data removes the saved layers, and layers are not synchronized across browsers or devices.

An internet connection is required for map tiles and online services:

| Service | Purpose |
| --- | --- |
| OpenStreetMap | Base map tiles |
| Nominatim | Named-place and route-stop search |
| Postpass | Viewport-scoped OpenStreetMap category search |
| OSRM | Cycling, walking, and driving route calculation |
| Komoot | Shared Tour retrieval through Mapstack's import endpoint |

These providers receive the queries or coordinates needed to fulfill each request and are subject to their own availability, usage policies, and terms.

Komoot links are handled differently from local file uploads. The browser sends the share link to `/api/komoot/import`, where the Tour URL is validated before the server requests GPX data. If GPX export is denied, the server can fall back to public Tour coordinates and generate GPX. Request limits, timeouts, and rate limiting protect this endpoint. Komoot credentials are never requested or stored.

## Technology

- **Frontend:** React 18, TypeScript, and Vite
- **Mapping:** Leaflet and React-Leaflet
- **UI:** Custom CSS and Lucide icons
- **Backend:** Node HTTP middleware for development and preview, plus a serverless adapter for Komoot imports
- **Testing:** Node's built-in test runner with Vite's TypeScript module loading

## Running locally

### Prerequisites

- Node.js 18 or newer
- npm

### Install and start

```sh
npm install
npm run dev
```

Open `https://localhost:5173/`. Vite uses a locally generated HTTPS certificate so geolocation can also be tested on mobile devices over the local network. The browser may ask you to trust the development certificate.

No API keys or environment variables are required by the application.

### Other commands

```sh
npm test        # Run the automated test suite
npm run build   # Type-check and create the production build in dist/
npm run preview # Serve the production build with the Komoot middleware
```

## Project structure

```text
src/
  components/       Map, search, route planner, import, and dialog components
  hooks/            Layer persistence and geolocation state
  utils/            GPX parsing, routing, search, and Komoot URL handling
server/             Komoot import handler and rate limiting
api/komoot/         Production serverless adapter
tests/              Node test suites
vite.config.ts      Vite, HTTPS, and development/preview middleware setup
```

## Deployment notes

`npm run build` produces the frontend in `dist/`. Development and preview servers automatically include the Komoot import middleware. A production deployment must also support the Node serverless handler in `api/komoot/import.ts` for Komoot imports to work; hosting only the static files is not sufficient for that feature.

Komoot's app endpoints are undocumented and may change. Manual GPX export and file upload remain available as a fallback.

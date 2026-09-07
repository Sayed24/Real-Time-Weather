# Real-Time Weather + Location Dashboard

A polished, responsive, frontend-only weather dashboard built for a developer portfolio and deployed with GitHub Pages.

## Highlights

- Live city weather from the OpenWeather API
- Search with live geocoding suggestions and keyboard navigation
- One-click browser geolocation
- Celsius / Fahrenheit toggle plus simultaneous °C / °F display
- Humidity, wind direction/speed, pressure, cloud cover, visibility, dew point, sunrise and sunset
- Five-day forecast generated from OpenWeather's 3-hour forecast feed
- Responsive 24-hour temperature chart with Chart.js
- Custom Material-inspired SVG weather icons
- Favorites and recent searches stored in `localStorage`
- Persistent light/dark theme
- Fully responsive mobile-first layout, including iPhone safe-area handling
- Accessible status messages, keyboard search controls, reduced-motion support and graceful API/chart failures
- GitHub Pages friendly: no backend or build step required

## Run locally

Open `index.html` through a local web server (for example VS Code Live Server) for the best browser API behavior.

## Deploy to GitHub Pages

1. Push these files to the repository's `main` branch.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, then `main` and `/ (root)`.
4. Save and open the generated Pages URL.

## Project files

- `index.html` — semantic dashboard UI
- `style.css` — Material-inspired responsive design system
- `script.js` — API integration and application logic
- `manifest.json` — installable-app metadata

## Portfolio focus

This project demonstrates REST API integration, async JavaScript, browser geolocation, client-side persistence, data transformation, responsive UI engineering, accessibility, error handling and data visualization.

Designed and developed by **Sayedrahim Sadat**.

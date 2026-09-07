/*
  Real-Time Weather • Portfolio Edition
  Existing features preserved and expanded:
  - OpenWeather current weather + 5 day / 3 hour forecast
  - Celsius/Fahrenheit toggle with simultaneous dual-unit display
  - Geolocation button
  - Custom Material-style SVG weather icons
  - Chart.js 24-hour temperature chart
  - Favorites + recent searches in localStorage
  - Live geocoding suggestions with local fallback
  - Light/dark theme persistence
  - Explicit non-blocking loader state (fixes stuck spinner)
*/

const OWM_KEY = "ffa6785971f790f0d310af9923f0de7b";
const API_BASE = "https://api.openweathermap.org";

const $ = (id) => document.getElementById(id);
const app = $("app");
const loader = $("loader");
const cityInput = $("cityInput");
const searchBtn = $("searchBtn");
const locBtn = $("locBtn");
const cityNameEl = $("cityName");
const weatherDesc = $("weatherDesc");
const weatherIcon = $("weatherIcon");
const tempNow = $("tempNow");
const tempBoth = $("tempBoth");
const feelsLikeEl = $("feelsLike");
const tempHigh = $("tempHigh");
const tempLow = $("tempLow");
const humidityEl = $("humidity");
const windEl = $("wind");
const windLabel = $("windLabel");
const pressureEl = $("pressure");
const cloudsEl = $("clouds");
const visibilityEl = $("visibility");
const dewPointEl = $("dewPoint");
const sunriseEl = $("sunrise");
const sunsetEl = $("sunset");
const localTimeEl = $("localTime");
const forecastList = $("forecastList");
const unitToggle = $("unitToggle");
const themeToggle = $("themeToggle");
const lastSaved = $("lastSaved");
const toast = $("toast");
const suggestions = $("suggestions");
const addFavBtn = $("addFavBtn");
const favoritesListEl = $("favoritesList");
const favoriteCount = $("favoriteCount");
const hourlyCanvas = $("hourlyChart");
const chartFallback = $("chartFallback");
const chartUnitLabel = $("chartUnitLabel");
const recentSearchesEl = $("recentSearches");
const clearRecentBtn = $("clearRecentBtn");

let hourlyChart = null;
let currentWeatherData = null;
let forecastData = null;
let loaderTimer = null;
let toastTimer = null;
let suggestionTimer = null;
let activeSuggestionIndex = -1;
let lastSuggestionItems = [];

let unitPref = safeStorageGet("weather_unit", "metric");
let theme = safeStorageGet("weather_theme", "light");
let favorites = safeJsonParse(safeStorageGet("weather_favorites", "[]"), []);
let recentSearches = safeJsonParse(safeStorageGet("weather_recent", "[]"), []);
let lastCity = safeStorageGet("weather_last_city", "");

const FALLBACK_CITIES = [
  "Sacramento, US", "San Francisco, US", "Los Angeles, US", "New York, US",
  "Chicago, US", "Seattle, US", "London, GB", "Paris, FR", "Berlin, DE",
  "Tokyo, JP", "Sydney, AU", "Dubai, AE", "Kabul, AF", "Herat, AF"
];

function safeStorageGet(key, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage can be unavailable in private modes */ }
}
function safeStorageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}
function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function showLoader(show = true) {
  if (!loader) return;
  clearTimeout(loaderTimer);

  if (show) {
    loader.hidden = false;
    loader.classList.add("is-active");
    loaderTimer = setTimeout(() => {
      hideLoader();
      showToast("The request is taking longer than expected. Please try again.");
    }, 10000);
  } else {
    hideLoader();
  }
}

function hideLoader() {
  clearTimeout(loaderTimer);
  if (!loader) return;
  loader.classList.remove("is-active");
  loader.hidden = true;
}

function showToast(message, duration = 3200) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
}

function capitalize(value = "") {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
function cToF(c) { return (c * 9 / 5) + 32; }
function kmToMiles(km) { return km * 0.621371; }
function msToMph(ms) { return ms * 2.23694; }
function round(value) { return Math.round(Number(value)); }
function tempForUnit(celsius) { return unitPref === "metric" ? round(celsius) : round(cToF(celsius)); }
function unitSymbol() { return unitPref === "metric" ? "°C" : "°F"; }

function degreesToCompass(degrees = 0) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function calculateDewPoint(tempC, humidity) {
  if (!Number.isFinite(tempC) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

function formatUnixTime(timestamp, offsetSeconds = 0) {
  if (!timestamp) return "—";
  const utc = (timestamp + offsetSeconds) * 1000;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit", timeZone: "UTC"
  }).format(new Date(utc));
}

function formatLocalTime(offsetSeconds = 0) {
  const shifted = Date.now() + (offsetSeconds * 1000) + (new Date().getTimezoneOffset() * 60000);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(shifted));
}

function dateLabelFromUnix(timestamp, offsetSeconds = 0) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date((timestamp + offsetSeconds) * 1000));
}

function timeLabelFromUnix(timestamp, offsetSeconds = 0) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" })
    .format(new Date((timestamp + offsetSeconds) * 1000));
}

function svgDataFor(main = "", description = "") {
  const condition = main.toLowerCase();
  const sun = "#f6b73c", cloud = "#98a1b7", rain = "#5aa8ff", snow = "#b7e7ff", bolt = "#ffca4f", mist = "#a6aebd";
  let body = "";

  if (condition.includes("clear")) {
    body = `<g stroke='${sun}' stroke-width='2.8' stroke-linecap='round'><circle cx='32' cy='32' r='11' fill='${sun}' stroke='none'/><path d='M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6'/></g>`;
  } else if (condition.includes("thunder")) {
    body = `<path d='M17 35c-6 0-10-4-10-9 0-6 5-10 11-10 3-7 9-11 17-11 10 0 18 7 19 17 4 1 7 5 7 9 0 6-5 10-11 10H17z' fill='${cloud}'/><path d='M31 33l-7 14h8l-4 12 14-18h-8l5-8z' fill='${bolt}'/>`;
  } else if (condition.includes("rain") || condition.includes("drizzle")) {
    body = `<path d='M17 35c-6 0-10-4-10-9 0-6 5-10 11-10 3-7 9-11 17-11 10 0 18 7 19 17 4 1 7 5 7 9 0 6-5 10-11 10H17z' fill='${cloud}'/><g stroke='${rain}' stroke-width='3' stroke-linecap='round'><path d='M20 45l-3 7M33 45l-3 7M46 45l-3 7'/></g>`;
  } else if (condition.includes("snow")) {
    body = `<path d='M17 34c-6 0-10-4-10-9 0-6 5-10 11-10 3-7 9-11 17-11 10 0 18 7 19 17 4 1 7 5 7 9 0 6-5 10-11 10H17z' fill='${cloud}'/><g fill='${snow}'><circle cx='20' cy='47' r='2.5'/><circle cx='33' cy='51' r='2.5'/><circle cx='46' cy='47' r='2.5'/></g>`;
  } else if (condition.includes("mist") || condition.includes("fog") || condition.includes("haze")) {
    body = `<g stroke='${mist}' stroke-width='4' stroke-linecap='round'><path d='M12 23h40M8 32h48M14 41h36'/></g>`;
  } else {
    body = `<circle cx='23' cy='23' r='9' fill='${sun}'/><path d='M19 43c-6 0-10-4-10-9 0-6 5-10 11-10 3-6 8-9 15-9 9 0 16 6 17 15 4 1 7 4 7 8 0 6-5 10-11 10H19z' fill='${cloud}'/>`;
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' role='img' aria-label='${description.replace(/'/g, "")}'><g>${body}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function fetchJSON(url, timeout = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    let payload = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      const message = payload?.message ? capitalize(String(payload.message)) : `Request failed (${response.status})`;
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Weather service timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCurrentByCity(query) {
  return fetchJSON(`${API_BASE}/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${OWM_KEY}&units=metric`);
}
async function fetchCurrentByCoords(lat, lon) {
  return fetchJSON(`${API_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
}
async function fetchForecastByCoords(lat, lon) {
  return fetchJSON(`${API_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
}
async function fetchCitySuggestions(query) {
  const items = await fetchJSON(`${API_BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${OWM_KEY}`, 5000);
  return Array.isArray(items) ? items : [];
}

function renderCurrent(data) {
  if (!data?.main || !data?.weather?.[0]) return;
  currentWeatherData = data;

  const weather = data.weather[0];
  const country = data.sys?.country || "";
  cityNameEl.textContent = [data.name, country].filter(Boolean).join(", ");
  weatherDesc.textContent = weather.description || "—";
  weatherIcon.src = svgDataFor(weather.main, weather.description);
  weatherIcon.alt = weather.description || "Current weather";

  const c = data.main.temp;
  const f = cToF(c);
  tempNow.textContent = `${tempForUnit(c)}${unitSymbol()}`;
  tempBoth.textContent = `${round(c)}°C / ${round(f)}°F`;
  feelsLikeEl.textContent = `Feels like ${tempForUnit(data.main.feels_like)}${unitSymbol()}`;
  tempHigh.textContent = `${tempForUnit(data.main.temp_max)}°`;
  tempLow.textContent = `${tempForUnit(data.main.temp_min)}°`;

  humidityEl.textContent = `${data.main.humidity}%`;
  pressureEl.textContent = `${data.main.pressure} hPa`;
  cloudsEl.textContent = `${data.clouds?.all ?? 0}%`;
  visibilityEl.textContent = unitPref === "metric"
    ? `${((data.visibility ?? 0) / 1000).toFixed(1)} km`
    : `${kmToMiles((data.visibility ?? 0) / 1000).toFixed(1)} mi`;

  const dew = calculateDewPoint(c, data.main.humidity);
  dewPointEl.textContent = dew === null ? "—" : `${tempForUnit(dew)}°`;

  const windSpeed = Number(data.wind?.speed ?? 0);
  windEl.textContent = unitPref === "metric" ? `${windSpeed.toFixed(1)} m/s` : `${msToMph(windSpeed).toFixed(1)} mph`;
  windLabel.textContent = `Wind ${degreesToCompass(data.wind?.deg ?? 0)}`;

  sunriseEl.textContent = formatUnixTime(data.sys?.sunrise, data.timezone);
  sunsetEl.textContent = formatUnixTime(data.sys?.sunset, data.timezone);
  localTimeEl.textContent = formatLocalTime(data.timezone);
  lastSaved.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  document.title = `${round(c)}°C • ${data.name} | Real-Time Weather`;

  safeStorageSet("weather_last_city", data.name || "");
  lastCity = data.name || lastCity;
  setWeatherMood(weather.main);
  updateFavoriteButtonState();
}

function setWeatherMood(main = "") {
  document.body.dataset.weather = main.toLowerCase();
}

function buildDailyGroups(data) {
  const timezone = data?.city?.timezone ?? 0;
  const groups = new Map();
  for (const item of data?.list ?? []) {
    const date = new Date((item.dt + timezone) * 1000).toISOString().slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  }
  return [...groups.values()].slice(0, 5);
}

function representativeWeather(items) {
  const noonish = [...items].sort((a, b) => Math.abs(12 - new Date(a.dt * 1000).getUTCHours()) - Math.abs(12 - new Date(b.dt * 1000).getUTCHours()))[0];
  return noonish?.weather?.[0] || items[0]?.weather?.[0] || { main: "Clouds", description: "Cloudy" };
}

function renderForecast(data) {
  forecastData = data;
  forecastList.innerHTML = "";
  const timezone = data?.city?.timezone ?? 0;
  const dailyGroups = buildDailyGroups(data);

  dailyGroups.forEach((items) => {
    const representative = representativeWeather(items);
    const temps = items.map(item => item.main.temp);
    const low = Math.min(...temps);
    const high = Math.max(...temps);
    const average = temps.reduce((sum, temp) => sum + temp, 0) / temps.length;

    const card = document.createElement("article");
    card.className = "forecast-item";
    card.innerHTML = `
      <div class="forecast-day">${dateLabelFromUnix(items[0].dt, timezone)}</div>
      <img src="${svgDataFor(representative.main, representative.description)}" alt="${representative.description}">
      <div class="forecast-temp">${tempForUnit(average)}${unitSymbol()}</div>
      <div class="forecast-range">${tempForUnit(low)}° / ${tempForUnit(high)}°</div>
      <div class="forecast-desc">${capitalize(representative.description)}</div>
    `;
    forecastList.appendChild(card);
  });
}

function renderHourlyChart(data) {
  if (!hourlyCanvas) return;
  const points = (data?.list ?? []).slice(0, 8);
  if (!points.length) return;

  if (typeof window.Chart === "undefined") {
    chartFallback.hidden = false;
    hourlyCanvas.hidden = true;
    return;
  }

  chartFallback.hidden = true;
  hourlyCanvas.hidden = false;
  const timezone = data?.city?.timezone ?? 0;
  const labels = points.map(point => timeLabelFromUnix(point.dt, timezone));
  const values = points.map(point => tempForUnit(point.main.temp));
  const descriptions = points.map(point => capitalize(point.weather?.[0]?.description ?? "Weather"));
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue("--primary").trim() || "#6750a4";
  const muted = styles.getPropertyValue("--muted").trim() || "#747285";
  const border = styles.getPropertyValue("--border").trim() || "rgba(77,70,110,.12)";

  hourlyChart?.destroy();
  hourlyChart = new Chart(hourlyCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: primary,
        backgroundColor: `${primary}18`,
        fill: true,
        tension: .42,
        pointRadius: 3.5,
        pointHoverRadius: 5,
        pointBackgroundColor: primary,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || "",
            label: (context) => `${context.parsed.y}${unitSymbol()} • ${descriptions[context.dataIndex]}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { grid: { color: border }, ticks: { color: muted, callback: value => `${value}°` } }
      }
    }
  });
  chartUnitLabel.textContent = unitSymbol();
}

function rerenderUnitDependentViews() {
  if (currentWeatherData) renderCurrent(currentWeatherData);
  if (forecastData) {
    renderForecast(forecastData);
    renderHourlyChart(forecastData);
  }
}

function normalizeCityName(city) {
  return String(city || "").trim().replace(/\s+/g, " ");
}

function saveFavorites() {
  favorites = [...new Set(favorites.map(normalizeCityName).filter(Boolean))].slice(0, 10);
  safeStorageSet("weather_favorites", JSON.stringify(favorites));
  renderFavorites();
  updateFavoriteButtonState();
}

function addFavorite(city) {
  const clean = normalizeCityName(city);
  if (!clean) return showToast("Search for a city first.");
  if (favorites.some(item => item.toLowerCase() === clean.toLowerCase())) return showToast(`${clean} is already in favorites.`);
  favorites.unshift(clean);
  saveFavorites();
  showToast(`${clean} added to favorites.`);
}

function removeFavorite(city) {
  favorites = favorites.filter(item => item.toLowerCase() !== city.toLowerCase());
  saveFavorites();
  showToast(`${city} removed from favorites.`);
}

function renderFavorites() {
  favoritesListEl.innerHTML = "";
  favoriteCount.textContent = favorites.length;
  if (!favorites.length) {
    const li = document.createElement("li");
    li.className = "favorite-empty";
    li.textContent = "No favorites yet. Save a city to access it quickly.";
    favoritesListEl.appendChild(li);
    return;
  }

  favorites.forEach(city => {
    const li = document.createElement("li");
    li.className = "favorite-row";
    li.innerHTML = `<button class="favorite-city" type="button"></button><button class="favorite-remove" type="button" aria-label="Remove ${city}">×</button>`;
    li.querySelector(".favorite-city").textContent = city;
    li.querySelector(".favorite-city").addEventListener("click", () => searchCity(city));
    li.querySelector(".favorite-remove").addEventListener("click", () => removeFavorite(city));
    favoritesListEl.appendChild(li);
  });
}

function updateFavoriteButtonState() {
  const city = currentWeatherData?.name || "";
  const isSaved = favorites.some(item => item.toLowerCase() === city.toLowerCase());
  addFavBtn.textContent = isSaved ? "★ Saved to favorites" : "☆ Add current city to favorites";
  addFavBtn.setAttribute("aria-pressed", String(isSaved));
}

function addRecent(city) {
  const clean = normalizeCityName(city);
  if (!clean) return;
  recentSearches = [clean, ...recentSearches.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
  safeStorageSet("weather_recent", JSON.stringify(recentSearches));
  renderRecentSearches();
}

function renderRecentSearches() {
  recentSearchesEl.innerHTML = "";
  if (!recentSearches.length) {
    const span = document.createElement("span");
    span.className = "recent-empty";
    span.textContent = "Your recent cities will appear here.";
    recentSearchesEl.appendChild(span);
    return;
  }
  recentSearches.forEach(city => {
    const button = document.createElement("button");
    button.className = "recent-chip";
    button.type = "button";
    button.textContent = city;
    button.addEventListener("click", () => searchCity(city));
    recentSearchesEl.appendChild(button);
  });
}

async function loadWeatherFromCurrent(current) {
  renderCurrent(current);
  const forecast = await fetchForecastByCoords(current.coord.lat, current.coord.lon);
  renderForecast(forecast);
  renderHourlyChart(forecast);
  addRecent(current.name);
}

async function searchCity(query, { silent = false } = {}) {
  const clean = normalizeCityName(query);
  if (!clean) return showToast("Enter a city name.");
  suggestions.hidden = true;
  cityInput.value = clean;
  if (!silent) showLoader(true);

  try {
    const current = await fetchCurrentByCity(clean);
    await loadWeatherFromCurrent(current);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to load weather for that city.");
  } finally {
    hideLoader();
  }
}

function useMyLocation() {
  if (!navigator.geolocation) return showToast("Geolocation is not supported on this device.");
  showLoader(true);
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const current = await fetchCurrentByCoords(coords.latitude, coords.longitude);
      cityInput.value = current.name || "";
      await loadWeatherFromCurrent(current);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Unable to load weather for your location.");
    } finally {
      hideLoader();
    }
  }, (error) => {
    hideLoader();
    const message = error.code === 1 ? "Location permission was denied. You can still search by city." : "Your location is unavailable right now.";
    showToast(message);
  }, { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 });
}

function fallbackSuggestions(query) {
  const lower = query.toLowerCase();
  return FALLBACK_CITIES.filter(city => city.toLowerCase().includes(lower)).slice(0, 5).map(label => ({ label }));
}

function suggestionLabel(item) {
  if (item.label) return item.label;
  return [item.name, item.state, item.country].filter(Boolean).join(", ");
}

function renderSuggestions(items) {
  lastSuggestionItems = items;
  activeSuggestionIndex = -1;
  suggestions.innerHTML = "";
  if (!items.length) {
    suggestions.hidden = true;
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.tabIndex = -1;
    li.dataset.index = index;
    li.textContent = suggestionLabel(item);
    li.addEventListener("mousedown", event => event.preventDefault());
    li.addEventListener("click", () => selectSuggestion(index));
    suggestions.appendChild(li);
  });
  suggestions.hidden = false;
}

function selectSuggestion(index) {
  const item = lastSuggestionItems[index];
  if (!item) return;
  const value = suggestionLabel(item);
  cityInput.value = item.name || value.split(",")[0];
  suggestions.hidden = true;
  searchCity(cityInput.value);
}

async function handleSuggestions(query) {
  const clean = normalizeCityName(query);
  if (clean.length < 2) {
    suggestions.hidden = true;
    return;
  }
  try {
    const results = await fetchCitySuggestions(clean);
    renderSuggestions(results.length ? results : fallbackSuggestions(clean));
  } catch {
    renderSuggestions(fallbackSuggestions(clean));
  }
}

function moveSuggestion(direction) {
  if (suggestions.hidden || !lastSuggestionItems.length) return;
  activeSuggestionIndex = (activeSuggestionIndex + direction + lastSuggestionItems.length) % lastSuggestionItems.length;
  [...suggestions.children].forEach((child, index) => child.classList.toggle("active", index === activeSuggestionIndex));
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", theme === "dark");
  themeToggle.textContent = theme === "dark" ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  unitToggle.textContent = unitPref === "metric" ? "°C" : "°F";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0d1020" : "#6750a4");
  if (forecastData) renderHourlyChart(forecastData);
}

searchBtn.addEventListener("click", () => searchCity(cityInput.value));
locBtn.addEventListener("click", useMyLocation);
addFavBtn.addEventListener("click", () => addFavorite(currentWeatherData?.name || cityInput.value));
unitToggle.addEventListener("click", () => {
  unitPref = unitPref === "metric" ? "imperial" : "metric";
  safeStorageSet("weather_unit", unitPref);
  unitToggle.textContent = unitPref === "metric" ? "°C" : "°F";
  rerenderUnitDependentViews();
});
themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  safeStorageSet("weather_theme", theme);
  applyTheme();
});
clearRecentBtn.addEventListener("click", () => {
  recentSearches = [];
  safeStorageRemove("weather_recent");
  renderRecentSearches();
  showToast("Recent searches cleared.");
});

cityInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => handleSuggestions(cityInput.value), 260);
});
cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (activeSuggestionIndex >= 0) selectSuggestion(activeSuggestionIndex);
    else searchCity(cityInput.value);
  } else if (event.key === "ArrowDown") {
    event.preventDefault(); moveSuggestion(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault(); moveSuggestion(-1);
  } else if (event.key === "Escape") {
    suggestions.hidden = true;
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrapper")) suggestions.hidden = true;
});
window.addEventListener("online", () => showToast("You’re back online."));
window.addEventListener("offline", () => showToast("You’re offline. Saved preferences still work."));
window.addEventListener("error", (event) => {
  console.error("Unhandled error:", event.error || event.message);
  hideLoader();
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  hideLoader();
});

async function init() {
  // Critical: loader always begins hidden. It appears only while a user-visible request is active.
  hideLoader();
  applyTheme();
  renderFavorites();
  renderRecentSearches();

  const initialCity = lastCity || "Sacramento";
  cityInput.value = initialCity;
  await searchCity(initialCity, { silent: true });
}

init();

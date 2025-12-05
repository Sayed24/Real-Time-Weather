/* Weather • Material 3 Dashboard (with custom SVG icons, hourly Chart.js, favorites)
   - Insert your OpenWeatherMap API key below
   - Features: dual units display, loader fixed, custom SVG icons (material style),
     hourly chart (Chart.js, next ~24h), favorites list (localStorage), suggestions,
     geolocation, 5-day forecast, theme toggle.
*/

const OWM_KEY = "YOUR_OPENWEATHER_API_KEY>"; // <-- add your key

// DOM refs
const app = document.getElementById('app');
const loader = document.getElementById('loader');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const cityNameEl = document.getElementById('cityName');
const weatherDesc = document.getElementById('weatherDesc');
const weatherIcon = document.getElementById('weatherIcon'); // remains an <img>
const tempNow = document.getElementById('tempNow');
const tempBoth = document.getElementById('tempBoth');
const feelsLikeEl = document.getElementById('feelsLike');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const pressureEl = document.getElementById('pressure');
const cloudsEl = document.getElementById('clouds');
const sunriseEl = document.getElementById('sunrise');
const sunsetEl = document.getElementById('sunset');
const forecastList = document.getElementById('forecastList');
const unitToggle = document.getElementById('unitToggle');
const themeToggle = document.getElementById('themeToggle');
const lastSaved = document.getElementById('lastSaved');
const toast = document.getElementById('toast');
const suggestions = document.getElementById('suggestions');
const addFavBtn = document.getElementById('addFavBtn');
const favoritesListEl = document.getElementById('favoritesList');
const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');

let hourlyChart = null;

let unitPref = localStorage.getItem('weather_unit') || 'metric'; // 'metric' (C) or 'imperial' (F)
let theme = localStorage.getItem('weather_theme') || 'light';
let lastCity = localStorage.getItem('weather_last_city') || '';
let favorites = JSON.parse(localStorage.getItem('weather_favorites') || '[]');

let suggestionsList = [
  "Sacramento","Folsom","New York","Los Angeles","San Francisco",
  "Houston","Dallas","Chicago","London","Berlin","Dubai",
  "Kabul","Herat","Tokyo","Sydney","Paris","Rome","Madrid"
];

// ---------- loader & toast ----------
function showLoader(show = true){
  if(show){
    loader.hidden = false;
    app.style.filter = 'blur(2px)';
    app.style.pointerEvents = 'none';
  } else {
    loader.hidden = true;
    app.style.filter = '';
    app.style.pointerEvents = '';
  }
}

function showToast(msg, ms=3500){
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(()=> toast.hidden = true, ms);
}

// ---------- helpers ----------
function capitalize(s){ if(!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtTime(ts, tzOffset){
  try{
    const d = new Date((ts + (tzOffset||0)) * 1000);
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }catch(e){ return '—'; }
}
function cToF(c){ return (c * 9/5) + 32; }
function formatWind(ms){ const mph = Math.round(ms * 2.23694); return `${ms} m/s (${mph} mph)`; }
function setWeatherBg(main){
  const appRoot = document.querySelector('.app');
  appRoot.classList.remove('sunny','rainy','cloudy','snow');
  if(!main) return;
  main = main.toLowerCase();
  if(main.includes('clear')) appRoot.classList.add('sunny');
  else if(main.includes('rain') || main.includes('drizzle') || main.includes('thunder')) appRoot.classList.add('rainy');
  else if(main.includes('cloud')) appRoot.classList.add('cloudy');
  else if(main.includes('snow')) appRoot.classList.add('snow');
}

// ---------- custom Material-style SVGs as data-URLs ----------
function svgDataFor(main, description){
  // create a simple material-ish SVG for main weather types
  const baseFill = '#6750A4'; // primary purple
  const sunFill = '#FFB300';
  const cloudFill = '#9AA4BF';
  const rainFill = '#4DA6FF';
  const snowFill = '#9FD8FF';
  const thunderFill = '#FFC857';

  main = (main || '').toLowerCase();
  let svg = '';

  if(main.includes('clear')) {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='100%' height='100%' rx='12' fill='none'/><g transform='translate(6,6)'><circle cx='22' cy='22' r='10' fill='${sunFill}'/><g stroke='${sunFill}' stroke-width='2' stroke-linecap='round'><line x1='22' y1='-2' x2='22' y2='8'/><line x1='22' y1='36' x2='22' y2='46'/><line x1='-2' y1='22' x2='8' y2='22'/><line x1='36' y1='22' x2='46' y2='22'/></g></g></svg>`;
  } else if(main.includes('cloud')) {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g transform='translate(5,18)'><ellipse cx='26' cy='10' rx='18' ry='10' fill='${cloudFill}' /><ellipse cx='40' cy='16' rx='12' ry='8' fill='${cloudFill}'/></g></svg>`;
  } else if(main.includes('rain') || main.includes('drizzle')) {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g transform='translate(5,10)'><ellipse cx='26' cy='8' rx='18' ry='8' fill='${cloudFill}' /><g fill='${rainFill}'><path d='M20 28c0 3-4 7-4 7s-4-4-4-7 4-3 4 0z'/><path d='M32 28c0 3-4 7-4 7s-4-4-4-7 4-3 4 0z'/></g></g></svg>`;
  } else if(main.includes('thunder')) {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g transform='translate(5,6)'><ellipse cx='26' cy='8' rx='18' ry='8' fill='${cloudFill}' /><polygon points='26,20 20,36 30,36 24,52 44,28 34,28' fill='${thunderFill}'/></g></svg>`;
  } else if(main.includes('snow')) {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g transform='translate(5,6)'><ellipse cx='26' cy='8' rx='18' ry='8' fill='${cloudFill}' /><g fill='${snowFill}' transform='translate(8,28)'><circle cx='8' cy='4' r='2'/><circle cx='18' cy='14' r='2'/><circle cx='28' cy='6' r='2'/></g></g></svg>`;
  } else {
    // fallback simple sun/cloud combo
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g transform='translate(5,6)'><circle cx='12' cy='12' r='6' fill='${sunFill}'/><ellipse cx='34' cy='18' rx='16' ry='8' fill='${cloudFill}'/></g></svg>`;
  }

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// ---------- API calls ----------
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchCurrentByCity(q){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${OWM_KEY}&units=metric`;
  return fetchJSON(url);
}

async function fetchForecastByCoords(lat, lon){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  return fetchJSON(url);
}

async function fetchCurrentByCoords(lat, lon){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  return fetchJSON(url);
}

// ---------- rendering ----------
function renderCurrent(data){
  if(!data) return;
  const main = data.weather && data.weather[0] ? data.weather[0].main : '';
  const desc = data.weather && data.weather[0] ? data.weather[0].description : '';
  cityNameEl.textContent = `${data.name}, ${data.sys.country}`;
  weatherDesc.textContent = capitalize(desc || '—');

  // use our custom SVGs (material-style) as data-URIs
  weatherIcon.src = svgDataFor(main, desc);
  weatherIcon.alt = desc || '';

  const tempC = Math.round(data.main.temp);
  const tempF = Math.round(cToF(tempC));
  // show primary according to unitPref
  if(unitPref === 'metric'){
    tempNow.textContent = `${tempC}°C`;
    feelsLikeEl.textContent = `Feels like ${Math.round(data.main.feels_like)}°C`;
  } else {
    tempNow.textContent = `${tempF}°F`;
    feelsLikeEl.textContent = `Feels like ${Math.round(cToF(data.main.feels_like))}°F`;
  }
  tempBoth.textContent = `${tempC}°C / ${tempF}°F`;

  humidityEl.textContent = `${data.main.humidity}%`;
  windEl.textContent = formatWind(data.wind.speed);
  pressureEl.textContent = `${data.main.pressure} hPa`;
  cloudsEl.textContent = `${data.clouds && data.clouds.all ? data.clouds.all : '—'}%`;
  sunriseEl.textContent = fmtTime(data.sys.sunrise, data.timezone || 0);
  sunsetEl.textContent = fmtTime(data.sys.sunset, data.timezone || 0);

  setWeatherBg(main);
  lastSaved.textContent = `Last: ${new Date().toLocaleString()}`;
  localStorage.setItem('weather_last_city', `${data.name},${data.sys.country}`);
}

function renderForecast(data){
  if(!data || !data.list) { forecastList.innerHTML = ''; return; }

  const groups = {};
  data.list.forEach(item => {
    const dayKey = new Date(item.dt * 1000).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
    if(!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(item);
  });

  const keys = Object.keys(groups).slice(0,5);
  forecastList.innerHTML = '';
  keys.forEach(k => {
    const items = groups[k];
    const temps = items.map(i => i.main.temp);
    const avg = Math.round(temps.reduce((a,b)=>a+b,0)/temps.length);
    // choose most frequent icon
    const freq = {};
    items.forEach(i => {
      const key = i.weather[0].main + '|' + i.weather[0].description;
      freq[key] = (freq[key] || 0) + 1;
    });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    const [main, desc] = top.split('|');

    const el = document.createElement('div');
    el.className = 'forecast-item';
    el.innerHTML = `
      <div class="forecast-day">${k}</div>
      <img src="${svgDataFor(main, desc)}" alt="${desc}" />
      <div class="forecast-temp">${avg}°C</div>
      <div class="forecast-desc">${capitalize(desc)}</div>
    `;
    forecastList.appendChild(el);
  });
}

// ---------- hourly chart (using forecast 3-hour data) ----------
function renderHourlyChart(forecastData){
  if(!forecastData || !forecastData.list) {
    if(hourlyChart) { hourlyChart.destroy(); hourlyChart = null; }
    return;
  }

  // Take next 8 data points (~24 hours)
  const points = forecastData.list.slice(0,8);
  const labels = points.map(p => {
    return new Date(p.dt * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  });
  const temps = points.map(p => Math.round(p.main.temp));

  // create or update chart
  if(hourlyChart) {
    hourlyChart.data.labels = labels;
    hourlyChart.data.datasets[0].data = temps;
    hourlyChart.update();
  } else {
    hourlyChart = new Chart(hourlyCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Temperature (°C)',
          data: temps,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2,
          backgroundColor: 'rgba(103,80,164,0.12)',
          borderColor: '#6750A4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: false }
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  }
}

// ---------- favorites ----------
function saveFavorites(){
  localStorage.setItem('weather_favorites', JSON.stringify(favorites));
  renderFavorites();
}

function addFavorite(city){
  city = city.trim();
  if(!city) return;
  if(favorites.includes(city)) { showToast('Already in favorites'); return; }
  favorites.unshift(city);
  if(favorites.length > 10) favorites.pop();
  saveFavorites();
  showToast('Added to favorites');
}

function removeFavorite(city){
  favorites = favorites.filter(c => c !== city);
  saveFavorites();
}

function renderFavorites(){
  favoritesListEl.innerHTML = '';
  if(favorites.length === 0){
    const li = document.createElement('li');
    li.textContent = 'No favorites yet';
    favoritesListEl.appendChild(li);
    return;
  }
  favorites.forEach(city => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="fav-city">${city}</span>
      <div>
        <button class="btn" data-city="${city}" aria-label="Load ${city}">Load</button>
        <button class="remove-btn" data-city="${city}" aria-label="Remove ${city}">✕</button>
      </div>`;
    // load handler
    li.querySelector('.btn').addEventListener('click', (e)=>{
      const c = e.currentTarget.dataset.city;
      cityInput.value = c;
      searchCity(c);
    });
    li.querySelector('.remove-btn').addEventListener('click', (e)=>{
      const c = e.currentTarget.dataset.city;
      removeFavorite(c);
    });
    favoritesListEl.appendChild(li);
  });
}

// ---------- main flows ----------
async function searchCity(q){
  if(!q) { showToast('Type a city name.'); return; }
  try{
    showLoader(true);
    const current = await fetchCurrentByCity(q);
    renderCurrent(current);
    const forecast = await fetchForecastByCoords(current.coord.lat, current.coord.lon);
    renderForecast(forecast);
    renderHourlyChart(forecast);
  } catch(err){
    console.error(err);
    showToast(err.message || 'Error fetching weather');
  } finally {
    showLoader(false);
  }
}

function useMyLocation(){
  if(!navigator.geolocation){
    showToast('Geolocation not supported.');
    return;
  }
  showLoader(true);
  navigator.geolocation.getCurrentPosition(async pos => {
    try{
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const current = await fetchCurrentByCoords(lat, lon);
      renderCurrent(current);
      const forecast = await fetchForecastByCoords(lat, lon);
      renderForecast(forecast);
      renderHourlyChart(forecast);
    } catch(err){
      console.error(err);
      showToast('Unable to fetch weather for your location.');
    } finally {
      showLoader(false);
    }
  }, err => {
    showToast('Location permission denied or unavailable.');
    showLoader(false);
  }, {timeout:10000});
}

// ---------- UI events ----------
searchBtn.addEventListener('click', ()=> {
  const q = cityInput.value.trim();
  if(q) searchCity(q);
});
cityInput.addEventListener('keyup', e => {
  if(e.key === 'Enter') searchBtn.click();
  else handleSuggestions(cityInput.value);
});

function handleSuggestions(text){
  const val = (text || '').trim().toLowerCase();
  if(!val){ suggestions.hidden = true; suggestions.innerHTML = ''; return; }
  const filtered = suggestionsList.filter(s => s.toLowerCase().startsWith(val)).slice(0,8);
  suggestions.innerHTML = '';
  if(filtered.length === 0){ suggestions.hidden = true; return; }
  filtered.forEach(city => {
    const li = document.createElement('li');
    li.textContent = city;
    li.addEventListener('click', () => {
      cityInput.value = city;
      suggestions.hidden = true;
      searchCity(city);
    });
    suggestions.appendChild(li);
  });
  suggestions.hidden = false;
}
document.addEventListener('click', (e)=>{
  if(!document.querySelector('.search-wrapper').contains(e.target)){
    suggestions.hidden = true;
  }
});

unitToggle.addEventListener('click', ()=>{
  unitPref = unitPref === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weather_unit', unitPref);
  unitToggle.textContent = unitPref === 'metric' ? '°C' : '°F';
  // re-render last city to update primary unit display
  const last = localStorage.getItem('weather_last_city');
  if(last){
    const cityOnly = last.split(',')[0];
    searchCity(cityOnly);
  } else {
    showToast('Unit changed. Search a city to update primary unit.');
  }
});

themeToggle.addEventListener('click', ()=>{
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('weather_theme', theme);
  applyTheme();
});

addFavBtn.addEventListener('click', ()=>{
  const cur = localStorage.getItem('weather_last_city') || cityInput.value;
  if(!cur) { showToast('No city to add'); return; }
  const cityOnly = cur.split(',')[0].trim();
  addFavorite(cityOnly);
});

// ---------- theme & init ----------
function applyTheme(){
  if(theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  unitToggle.textContent = unitPref === 'metric' ? '°C' : '°F';
}

async function init(){
  applyTheme();
  renderFavorites();

  // ensure loader shown while we try initial loads, but hide on any error/finally
  showLoader(true);

  try {
    if(lastCity){
      cityInput.value = lastCity.split(',')[0];
      await searchCity(lastCity.split(',')[0]);
    } else {
      // try geolocation first, fallback to Sacramento
      if(navigator && navigator.geolocation){
        await new Promise((resolve) => {
          let resolved = false;
          navigator.geolocation.getCurrentPosition(async pos => {
            try{
              const lat = pos.coords.latitude;
              const lon = pos.coords.longitude;
              const current = await fetchCurrentByCoords(lat, lon);
              renderCurrent(current);
              const forecast = await fetchForecastByCoords(lat, lon);
              renderForecast(forecast);
              renderHourlyChart(forecast);
            } catch(e){
              console.warn('geo -> fallback', e);
              await searchCity('Sacramento');
            } finally {
              resolved = true;
              resolve();
            }
          }, async err => {
            // fallback
            await searchCity('Sacramento');
            resolved = true;
            resolve();
          }, {timeout:7000});
          // safety timeout in case geolocation never resolves
          setTimeout(()=> { if(!resolved){ searchCity('Sacramento').finally(()=>resolve()); } }, 9000);
        });
      } else {
        await searchCity('Sacramento');
      }
    }
  } catch(err){
    console.error('init error', err);
    showToast(err.message || 'Initialization error');
  } finally {
    showLoader(false);
  }
}

init();

// ---------- safe fetchCurrentByCoords (duplicate kept for usage) ----------
async function fetchCurrentByCoords(lat, lon){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  return fetchJSON(url);
}

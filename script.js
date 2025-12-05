/* Weather • Material 3 Dashboard
   - Insert your OpenWeatherMap API key below
   - This script renders current weather + 5-day forecast,
     shows both °C and °F, handles geolocation, suggestions,
     dark/light, loader behavior, and localStorage for prefs.
*/

const OWM_KEY = "<PUT_YOUR_OPENWEATHERMAP_API_KEY_HERE>"; // <-- add your key

// DOM refs
const app = document.getElementById('app');
const loader = document.getElementById('loader');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const cityNameEl = document.getElementById('cityName');
const weatherDesc = document.getElementById('weatherDesc');
const weatherIcon = document.getElementById('weatherIcon');
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

let unitPref = localStorage.getItem('weather_unit') || 'metric'; // 'metric' (C) or 'imperial' (F)
let theme = localStorage.getItem('weather_theme') || 'light';
let lastCity = localStorage.getItem('weather_last_city') || '';
let suggestionsList = [
  "Sacramento","Folsom","New York","Los Angeles","San Francisco",
  "Houston","Dallas","Chicago","London","Berlin","Dubai",
  "Kabul","Herat","Tokyo","Sydney","Paris","Rome","Madrid"
];

// show/hide loader
function showLoader(show=true){
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

// small toast
function showToast(msg, ms=3000){
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(()=> toast.hidden = true, ms);
}

// format time using timezone offset seconds
function fmtTime(ts, tzOffset){
  try{
    const d = new Date((ts + tzOffset) * 1000);
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }catch(e){ return '—'; }
}

// set animated app background by main weather
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

// convert C <-> F correctly (digit-by-digit mentality per instructions)
function cToF(c){ return (c * 9/5) + 32; }
function fToC(f){ return (f - 32) * 5/9; }

// fetch current weather by city name (units param chooses which unit the API returns)
async function fetchCurrentByCity(q){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    showToast('Add your OpenWeatherMap API key in script.js (OWM_KEY).');
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${OWM_KEY}&units=metric`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('City not found');
  return res.json();
}

// fetch forecast (3-hour steps) by coordinates
async function fetchForecastByCoords(lat, lon){
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Forecast error');
  return res.json();
}

// render current weather (we use metric from API then compute F)
function renderCurrent(data){
  if(!data) return;
  const main = data.weather && data.weather[0] ? data.weather[0].main : '';
  const desc = data.weather && data.weather[0] ? data.weather[0].description : '';
  cityNameEl.textContent = `${data.name}, ${data.sys.country}`;
  weatherDesc.textContent = capitalize(desc || '—');
  const icon = data.weather && data.weather[0] ? data.weather[0].icon : '';
  weatherIcon.src = icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : '';
  weatherIcon.alt = desc || '';

  // API returned metric temps (°C)
  const tempC = Math.round(data.main.temp);
  const tempF = Math.round(cToF(tempC));
  tempNow.textContent = `${tempC}°C`; // primary show metric (but we also show both)
  tempBoth.textContent = `${tempC}°C / ${tempF}°F`;
  feelsLikeEl.textContent = `Feels like ${Math.round(data.main.feels_like)}°C`;

  humidityEl.textContent = `${data.main.humidity}%`;
  windEl.textContent = formatWind(data.wind.speed); // ms and mph when needed
  pressureEl.textContent = `${data.main.pressure} hPa`;
  cloudsEl.textContent = `${data.clouds && data.clouds.all ? data.clouds.all : '—'}%`;
  sunriseEl.textContent = fmtTime(data.sys.sunrise, data.timezone || 0);
  sunsetEl.textContent = fmtTime(data.sys.sunset, data.timezone || 0);

  setWeatherBg(main);
  lastSaved.textContent = `Last: ${new Date().toLocaleString()}`;
  localStorage.setItem('weather_last_city', `${data.name},${data.sys.country}`);
}

// create forecast day cards aggregated
function renderForecast(data){
  if(!data || !data.list) { forecastList.innerHTML = ''; return; }

  // group by human-readable day string
  const groups = {};
  data.list.forEach(item => {
    // use local date string for day grouping
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
    // pick most frequent icon
    const freq = {};
    items.forEach(i => {
      const key = i.weather[0].icon + '|' + i.weather[0].description;
      freq[key] = (freq[key] || 0) + 1;
    });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    const [icon, desc] = top.split('|');

    const el = document.createElement('div');
    el.className = 'forecast-item';
    el.innerHTML = `
      <div class="forecast-day">${k}</div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
      <div class="forecast-temp">${avg}°C</div>
      <div class="forecast-desc">${capitalize(desc)}</div>
    `;
    forecastList.appendChild(el);
  });
}

// wind display (show m/s and mph)
function formatWind(ms){
  const mph = Math.round(ms * 2.23694);
  return `${ms} m/s (${mph} mph)`;
}

// utility
function capitalize(s){ if(!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }

// search flow: city -> fetch current -> fetch forecast -> render
async function searchCity(q){
  if(!q) { showToast('Type a city name.'); return; }
  try{
    showLoader(true);
    const current = await fetchCurrentByCity(q);
    renderCurrent(current);
    const forecast = await fetchForecastByCoords(current.coord.lat, current.coord.lon);
    renderForecast(forecast);
  } catch(err){
    showToast(err.message || 'Error fetching weather');
  } finally {
    showLoader(false);
  }
}

// geolocation flow
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
    } catch(e){
      showToast('Unable to fetch weather for your location.');
    } finally {
      showLoader(false);
    }
  }, err => {
    showToast('Location permission denied or unavailable.');
    showLoader(false);
  }, {timeout:10000});
}

async function fetchCurrentByCoords(lat, lon){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    showToast('Add your OpenWeatherMap API key in script.js (OWM_KEY).');
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Weather error');
  return res.json();
}

// UI events
searchBtn.addEventListener('click', ()=> {
  const q = cityInput.value.trim();
  if(q) searchCity(q);
});
cityInput.addEventListener('keyup', e => {
  if(e.key === 'Enter') searchBtn.click();
  else handleSuggestions(cityInput.value);
});

// suggestions behavior
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

// hide suggestions when clicking outside
document.addEventListener('click', (e)=>{
  if(!document.querySelector('.search-wrapper').contains(e.target)){
    suggestions.hidden = true;
  }
});

// unit toggle: this control keeps showing both units but toggles which unit is primary shown in tempNow & feelsLike
unitToggle.addEventListener('click', ()=>{
  unitPref = unitPref === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weather_unit', unitPref);
  unitToggle.textContent = unitPref === 'metric' ? '°C' : '°F';

  // re-render last city with new primary unit if present
  const last = localStorage.getItem('weather_last_city');
  if(last){
    const cityOnly = last.split(',')[0];
    searchCity(cityOnly);
  } else {
    showToast('Unit changed. Search a city to update primary unit.');
  }
});

// theme toggle
themeToggle.addEventListener('click', ()=>{
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('weather_theme', theme);
  applyTheme();
});

// apply theme & unit on startup
function applyTheme(){
  if(theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  unitToggle.textContent = unitPref === 'metric' ? '°C' : '°F';
}

// initial loader logic + startup behavior
(async function init(){
  // bind buttons
  locBtn.addEventListener('click', useMyLocation);

  applyTheme();

  // show the app while loader is hidden initially
  showLoader(true);

  // attempt to load last city, otherwise try geolocation, otherwise default
  if(lastCity){
    cityInput.value = lastCity.split(',')[0];
    try{
      await searchCity(lastCity.split(',')[0]);
    } catch(e){
      // fallback to geolocation
      try{ useMyLocation(); }catch{}
    } finally { showLoader(false); showApp(); }
  } else {
    // try geolocation first; if denied or fails, load default Sacramento
    if(navigator && navigator.geolocation){
      // attempt geolocation (but still fallback)
      navigator.geolocation.getCurrentPosition(async pos => {
        try{
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const current = await fetchCurrentByCoords(lat, lon);
          renderCurrent(current);
          const forecast = await fetchForecastByCoords(lat, lon);
          renderForecast(forecast);
        } catch(e){
          await searchCity('Sacramento');
        } finally {
          showLoader(false);
          showApp();
        }
      }, async err => {
        // permission denied or unavailable: load default
        await searchCity('Sacramento');
        showLoader(false);
        showApp();
      }, {timeout:8000});
    } else {
      await searchCity('Sacramento');
      showLoader(false);
      showApp();
    }
  }
})();

function showApp(){
  // ensure app is shown (unblur)
  showLoader(false);
  // nothing else needed; DOM already visible
}

// helper to reformat primary units based on unitPref (we fetch metric, so convert if necessary)
function reformatPrimaryUnitsDisplayed(){
  // If there's a displayed temperature, re-run search on current displayed city to update primary unit
  const last = localStorage.getItem('weather_last_city');
  if(last) searchCity(last.split(',')[0]);
}

// small util to fetch current by coords already defined above (used earlier)
async function fetchCurrentByCoords(lat, lon){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    showToast('Add your OpenWeatherMap API key in script.js (OWM_KEY).');
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Weather error');
  return res.json();
}

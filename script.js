/* Material 3 Weather Dashboard
   - Requires an OpenWeatherMap API key
   - Save the API key in the variable below before publishing:
*/
const OWM_KEY = "<PUT_YOUR_OPENWEATHERMAP_API_KEY_HERE>"; // <<-- insert your key

// DOM refs
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const cityName = document.getElementById('cityName');
const weatherDesc = document.getElementById('weatherDesc');
const weatherIcon = document.getElementById('weatherIcon');
const tempNow = document.getElementById('tempNow');
const feelsLike = document.getElementById('feelsLike');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const pressure = document.getElementById('pressure');
const clouds = document.getElementById('clouds');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');
const forecastList = document.getElementById('forecastList');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const unitToggle = document.getElementById('unitToggle');
const themeToggle = document.getElementById('themeToggle');
const lastSaved = document.getElementById('lastSaved');
const appRoot = document.getElementById('app');

let unit = localStorage.getItem('weather_unit') || 'metric'; // 'metric' or 'imperial'
let theme = localStorage.getItem('weather_theme') || 'light';
applyTheme();
updateUnitText();

function showToast(msg, duration = 3000){
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(()=> toast.hidden = true, duration);
}

function showLoader(show=true){
  loader.hidden = !show;
}

// Helpers
function fmtTime(ts, tzOffset){
  const d = new Date((ts + tzOffset) * 1000);
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function setWeatherBg(main){
  document.documentElement.classList.remove('sunny','rainy','cloudy','snow');
  const root = document.querySelector('.app');
  root.classList.remove('sunny','rainy','cloudy','snow');
  if(!main) return;
  main = main.toLowerCase();
  if(main.includes('clear')) root.classList.add('sunny');
  else if(main.includes('rain') || main.includes('drizzle') || main.includes('thunder')) root.classList.add('rainy');
  else if(main.includes('cloud')) root.classList.add('cloudy');
  else if(main.includes('snow')) root.classList.add('snow');
}

// API calls
async function fetchCurrentByCity(q){
  if(!OWM_KEY || OWM_KEY.startsWith('<')) {
    showToast('Add your OpenWeatherMap API key in script.js (OWM_KEY).');
    throw new Error('Missing API key');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${OWM_KEY}&units=${unit}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('City not found');
  return res.json();
}

async function fetchForecastByCoords(lat, lon){
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=${unit}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Forecast error');
  return res.json();
}

async function fetchCurrentByCoords(lat, lon){
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=${unit}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Weather error');
  return res.json();
}

// UI render
function renderCurrent(data){
  cityName.textContent = `${data.name}, ${data.sys.country}`;
  weatherDesc.textContent = `${capitalize(data.weather[0].description)}`;
  const icon = data.weather[0].icon;
  weatherIcon.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  weatherIcon.alt = data.weather[0].description;
  tempNow.textContent = `${Math.round(data.main.temp)}°${unit === 'metric' ? 'C' : 'F'}`;
  feelsLike.textContent = `Feels like ${Math.round(data.main.feels_like)}°`;
  humidity.textContent = `${data.main.humidity}%`;
  wind.textContent = `${formatWind(data.wind.speed)}`;
  pressure.textContent = `${data.main.pressure} hPa`;
  clouds.textContent = `${data.clouds.all}%`;
  sunrise.textContent = fmtTime(data.sys.sunrise, data.timezone);
  sunset.textContent = fmtTime(data.sys.sunset, data.timezone);
  setWeatherBg(data.weather[0].main);
  lastSaved.textContent = `Last: ${new Date().toLocaleString()}`;
  localStorage.setItem('weather_last_city', `${data.name},${data.sys.country}`);
}

function renderForecast(data){
  // data.list has 3-hour forecasts. Group by day (using local date)
  const groups = {};
  data.list.forEach(item => {
    const dt = new Date((item.dt + data.city.timezone) * 1000);
    // create a day key: yyyy-mm-dd
    const dayKey = new Date((item.dt) * 1000).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
    if(!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(item);
  });

  // we only want next 5 distinct days
  forecastList.innerHTML = '';
  const keys = Object.keys(groups).slice(0,5);
  keys.forEach(k => {
    const items = groups[k];
    // pick midday reading or compute average temp
    const temps = items.map(i => i.main.temp);
    const avgTemp = Math.round(temps.reduce((s,a)=>s+a,0) / temps.length);
    // choose the most frequent weather icon/desc
    const freq = {};
    items.forEach(i => {
      const key = i.weather[0].icon + '|' + i.weather[0].description;
      freq[key] = (freq[key]||0) + 1;
    });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    const [icon, desc] = top.split('|');

    const itemEl = document.createElement('div');
    itemEl.className = 'forecast-item';
    itemEl.innerHTML = `
      <div class="forecast-day">${k}</div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
      <div class="forecast-temp">${avgTemp}°</div>
      <div class="forecast-desc">${capitalize(desc)}</div>
    `;
    forecastList.appendChild(itemEl);
  });
}

// utilities
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function formatWind(ms){
  if(unit === 'metric') return `${ms} m/s`;
  return `${ms} mph`;
}

// main search flow
async function searchCity(q){
  try{
    showLoader(true);
    const current = await fetchCurrentByCity(q);
    renderCurrent(current);
    const forecast = await fetchForecastByCoords(current.coord.lat, current.coord.lon);
    renderForecast(forecast);
    showLoader(false);
  } catch(err){
    showLoader(false);
    showToast(err.message || 'Error fetching weather');
  }
}

async function useMyLocation(){
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
      showLoader(false);
    }catch(err){
      showLoader(false);
      showToast('Unable to fetch weather for your location.');
    }
  }, err => {
    showLoader(false);
    showToast('Location permission denied or unavailable.');
  }, {timeout:10000});
}

// events
searchBtn.addEventListener('click', ()=> {
  const q = cityInput.value.trim();
  if(!q) { showToast('Type a city name.'); return; }
  searchCity(q);
});
cityInput.addEventListener('keyup', e => { if(e.key === 'Enter') searchBtn.click(); });
locBtn.addEventListener('click', useMyLocation);

unitToggle.addEventListener('click', ()=>{
  unit = unit === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weather_unit', unit);
  updateUnitText();
  // re-search last city if any
  const last = localStorage.getItem('weather_last_city');
  if(last){
    const cityOnly = last.split(',')[0];
    searchCity(cityOnly);
  } else {
    showToast('Unit changed. Search a city to update values.');
  }
});

themeToggle.addEventListener('click', ()=>{
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('weather_theme', theme);
  applyTheme();
});

function updateUnitText(){
  unitToggle.textContent = unit === 'metric' ? '°C' : '°F';
}

function applyTheme(){
  if(theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.style.background = '';
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Initialize with last city if present
(function init(){
  // load prefs
  unit = localStorage.getItem('weather_unit') || unit;
  theme = localStorage.getItem('weather_theme') || theme;
  updateUnitText();
  applyTheme();

  const last = localStorage.getItem('weather_last_city');
  if(last) {
    const cityOnly = last.split(',')[0];
    cityInput.value = cityOnly;
    lastSaved.textContent = `Last: ${last}`;
    // attempt to fetch silently (do not throw if api key is missing)
    searchCity(cityOnly).catch(()=>{});
  } else {
    // optionally, try geolocation on first load
    // (commented out to respect user privacy - you can enable)
    // useMyLocation();
  }
})();

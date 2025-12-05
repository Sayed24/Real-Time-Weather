const API_KEY = "YOUR_API_KEY_HERE"; // ← put your OpenWeather API key here

const loader = document.getElementById("loader");
const app = document.getElementById("app");

const cityName = document.getElementById("cityName");
const tempC = document.getElementById("tempC");
const tempF = document.getElementById("tempF");
const description = document.getElementById("description");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const icon = document.getElementById("weatherIcon");

const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");


// SHOW LOADER
function showLoader() {
    loader.style.display = "block";
    app.style.display = "none";
}

// HIDE LOADER
function hideLoader() {
    loader.style.display = "none";
    app.style.display = "block";
}


// FETCH WEATHER
async function getWeather(city) {
    showLoader();

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;
        const res = await fetch(url);
        const data = await res.json();

        updateUI(data);

    } catch (err) {
        alert("Error loading weather.");
    } finally {
        hideLoader();
    }
}


// UPDATE UI
function updateUI(data) {
    const c = data.main.temp;
    const f = (c * 9/5) + 32;

    cityName.textContent = data.name;
    tempC.textContent = `Temperature: ${c.toFixed(1)}°C`;
    tempF.textContent = `Temperature: ${f.toFixed(1)}°F`;
    description.textContent = data.weather[0].description;
    humidity.textContent = `Humidity: ${data.main.humidity}%`;
    wind.textContent = `Wind: ${data.wind.speed} m/s`;

    // Animated icon
    const iconCode = data.weather[0].icon;
    icon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}


// AUTO DETECT LOCATION
function detectLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success => {
            const lat = success.coords.latitude;
            const lon = success.coords.longitude;

            loadWeatherByCoords(lat, lon);
        }, () => {
            getWeather("Sacramento"); // fallback
        });
    }
}

async function loadWeatherByCoords(lat, lon) {
    showLoader();
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const res = await fetch(url);
        const data = await res.json();

        updateUI(data);
    } catch {
        alert("Location error");
    } finally {
        hideLoader();
    }
}


// DARK MODE
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    themeToggle.textContent =
        document.body.classList.contains("dark") ? "☀️" : "🌙";
});


// CITY AUTOCOMPLETE (simple)
const sampleCities = [
    "Sacramento", "Folsom", "New York", "Los Angeles",
    "San Francisco", "Houston", "Dallas", "Chicago",
    "London", "Berlin", "Dubai", "Kabul", "Herat"
];

searchInput.addEventListener("input", () => {
    const text = searchInput.value.toLowerCase();

    if (text.length === 0) {
        suggestionsBox.style.display = "none";
        return;
    }

    const filtered = sampleCities.filter(city =>
        city.toLowerCase().startsWith(text)
    );

    suggestionsBox.innerHTML = "";
    filtered.forEach(city => {
        const li = document.createElement("li");
        li.textContent = city;
        li.onclick = () => {
            searchInput.value = city;
            suggestionsBox.style.display = "none";
            getWeather(city);
        };
        suggestionsBox.appendChild(li);
    });

    suggestionsBox.style.display = "block";
});


// DEFAULT: auto-detect location
detectLocation();

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export async function getWeather(latitude, longitude) {
  const params = new URLSearchParams({ latitude, longitude, timezone: 'auto', forecast_days: 5, current: 'temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code', hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,soil_moisture_0_to_1cm,et0_fao_evapotranspiration', daily: 'precipitation_probability_max,precipitation_sum,rain_sum,et0_fao_evapotranspiration' });
  const response = await fetch(`${OPEN_METEO_URL}?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo request failed: ${response.status}`);
  const data = await response.json();
  const hour = data.hourly;
  const currentIndex = Math.min(new Date().getHours(), hour.time.length - 1);
  const forecast = data.daily.time.map((date, index) => ({ date, rainProbability: data.daily.precipitation_probability_max[index], rainfall: data.daily.rain_sum[index], precipitation: data.daily.precipitation_sum[index], et0: data.daily.et0_fao_evapotranspiration[index] }));
  return { temperature: data.current.temperature_2m, humidity: data.current.relative_humidity_2m, rainfall: data.current.rain, rainProbability: data.daily.precipitation_probability_max[0], soilMoisture: Math.round((hour.soil_moisture_0_to_1cm[currentIndex] || 0) * 100), et0: data.daily.et0_fao_evapotranspiration[0], forecast };
}

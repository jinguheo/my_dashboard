export interface WeatherData {
  city: string
  temp: number
  feelsLike: number
  description: string
  icon: string
  humidity: number
}

export async function fetchWeather(city: string, apiKey: string): Promise<WeatherData> {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`
  )
  if (!res.ok) throw new Error('날씨 API 오류')
  const d = await res.json()
  return {
    city: d.name,
    temp: Math.round(d.main.temp),
    feelsLike: Math.round(d.main.feels_like),
    description: d.weather[0].description,
    icon: d.weather[0].icon,
    humidity: d.main.humidity,
  }
}

export function weatherEmoji(icon: string): string {
  if (icon.startsWith('01')) return '☀️'
  if (icon.startsWith('02')) return '⛅'
  if (icon.startsWith('03') || icon.startsWith('04')) return '☁️'
  if (icon.startsWith('09') || icon.startsWith('10')) return '🌧️'
  if (icon.startsWith('11')) return '⛈️'
  if (icon.startsWith('13')) return '❄️'
  if (icon.startsWith('50')) return '🌫️'
  return '🌤️'
}

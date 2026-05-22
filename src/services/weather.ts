export interface WeatherForecast {
  date: string    // "2024-05-17"
  maxTemp: number
  minTemp: number
  icon: string
}

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

// 한글 도시명 → Open-Meteo 위경도 (14일 예보용)
const CITY_COORDS: Record<string, [number, number]> = {
  '화성': [37.1996, 126.8312],
  '서울': [37.5665, 126.9780],
  '수원': [37.2636, 127.0286],
  '인천': [37.4563, 126.7052],
  '부산': [35.1796, 129.0756],
  '대구': [35.8722, 128.6025],
  '대전': [36.3504, 127.3845],
  '광주': [35.1595, 126.8526],
  '울산': [35.5384, 129.3114],
  '제주': [33.4996, 126.5312],
  '성남': [37.4200, 127.1265],
  '용인': [37.2411, 127.1776],
}

// WMO 날씨 코드 → 아이콘 코드
function wmoToIcon(code: number): string {
  if (code === 0) return '01d'
  if (code <= 2) return '02d'
  if (code === 3) return '04d'
  if (code <= 48) return '50d'
  if (code <= 57) return '09d'
  if (code <= 67) return '10d'
  if (code <= 77) return '13d'
  if (code <= 82) return '09d'
  if (code <= 86) return '13d'
  return '11d'
}

// 한글 도시명 → wttr.in 영문 쿼리 (화성=Mars로 오인 방지)
const CITY_QUERY: Record<string, string> = {
  '화성': 'Hwaseong, Gyeonggi, South Korea',
  '서울': 'Seoul, South Korea',
  '수원': 'Suwon, Gyeonggi, South Korea',
  '인천': 'Incheon, South Korea',
  '부산': 'Busan, South Korea',
  '대구': 'Daegu, South Korea',
  '대전': 'Daejeon, South Korea',
  '광주': 'Gwangju, South Korea',
  '울산': 'Ulsan, South Korea',
  '제주': 'Jeju, South Korea',
  '성남': 'Seongnam, Gyeonggi, South Korea',
  '용인': 'Yongin, Gyeonggi, South Korea',
}

export async function fetchWeatherFromMcp(endpoint: string, city: string): Promise<WeatherData> {
  const query = CITY_QUERY[city] ?? city  // 한글이면 영문으로 변환
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'weather.current', arguments: { city: query } },
    }),
  })
  if (!res.ok) throw new Error('MCP 날씨 요청 실패')
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'MCP 날씨 오류')
  const w = data?.result?.content?.[0]?.json ?? data?.result
  if (!w) throw new Error('MCP 날씨 응답 형식 오류')
  return { ...(w as WeatherData), city }  // 표시 이름은 원래 도시명 유지
}

export async function fetchWeatherForecastFromMcp(endpoint: string, city: string): Promise<WeatherForecast[]> {
  const query = CITY_QUERY[city] ?? city  // 한글 → 영문 (Python 인코딩 문제 방지)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'weather.forecast', arguments: { city: query } },
    }),
  })
  if (!res.ok) throw new Error('MCP 예보 요청 실패')
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const list = data?.result?.content?.[0]?.json ?? data?.result
  if (!Array.isArray(list)) throw new Error('MCP 예보 응답 형식 오류')
  return list as WeatherForecast[]
}

// wttr.in 날씨 코드 → OpenWeatherMap 아이콘 코드 변환
function wttrCodeToIcon(code: number): string {
  if (code === 113) return '01d'
  if (code === 116) return '02d'
  if (code === 119) return '03d'
  if (code === 122) return '04d'
  if ([143, 248, 260].includes(code)) return '50d'
  if ([200, 386, 389, 392, 395].includes(code)) return '11d'
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(code)) return '13d'
  if ([176, 263, 266, 281, 284, 293, 296, 311, 314, 353].includes(code)) return '09d'
  if ([299, 302, 305, 308, 356, 359].includes(code)) return '10d'
  return '02d'
}

export async function fetchWeatherFree(city: string): Promise<WeatherData> {
  const query = CITY_QUERY[city] ?? city
  const res = await fetch(`https://wttr.in/${encodeURIComponent(query)}?format=j1`)
  if (!res.ok) throw new Error('wttr.in 날씨 조회 실패')
  const d = await res.json()
  const c = d.current_condition[0]
  return {
    city,
    temp: Math.round(parseFloat(c.temp_C)),
    feelsLike: Math.round(parseFloat(c.FeelsLikeC)),
    description: c.weatherDesc[0].value,
    icon: wttrCodeToIcon(parseInt(c.weatherCode)),
    humidity: parseInt(c.humidity),
  }
}

export async function fetchWeatherForecastFree(city: string): Promise<WeatherForecast[]> {
  const query = CITY_QUERY[city] ?? city
  const res = await fetch(`https://wttr.in/${encodeURIComponent(query)}?format=j1`)
  if (!res.ok) throw new Error('wttr.in 예보 조회 실패')
  const d = await res.json()
  return (d.weather as any[]).map(day => ({
    date: day.date,
    maxTemp: Math.round(parseFloat(day.maxtempC)),
    minTemp: Math.round(parseFloat(day.mintempC)),
    icon: wttrCodeToIcon(parseInt(day.hourly?.[4]?.weatherCode ?? '113')),
  }))
}

// Open-Meteo로 14일 예보 조회 (API 키 불필요)
export async function fetchWeatherForecast14Free(city: string): Promise<WeatherForecast[]> {
  const coords = CITY_COORDS[city]
  if (!coords) return fetchWeatherForecastFree(city)
  const [lat, lon] = coords
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=14&timezone=Asia%2FSeoul`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Open-Meteo 14일 예보 조회 실패')
  const data = await res.json()
  const daily = data.daily
  return (daily.time as string[]).map((date, i) => ({
    date,
    maxTemp: Math.round(daily.temperature_2m_max[i]),
    minTemp: Math.round(daily.temperature_2m_min[i]),
    icon: wmoToIcon(parseInt(daily.weather_code[i])),
  }))
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

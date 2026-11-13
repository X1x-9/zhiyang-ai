export type WeatherProvider = "open-meteo" | "amap";

export type WeatherDay = {
  date: string;
  weather: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationProbability: number | null;
  windText: string;
  windSpeedMaxKmh: number | null;
  outdoorHint: string;
};

export type WeatherForecast = {
  ok: boolean;
  provider: WeatherProvider;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  days: WeatherDay[];
  fetchedAt: string;
  note: string;
};

type CacheEntry = { expiresAt: number; value: WeatherForecast };

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const cache = new Map<string, CacheEntry>();

const WMO_WEATHER: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "强毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "米雪",
  80: "阵雨",
  81: "强阵雨",
  82: "暴雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  99: "雷暴伴大冰雹",
};

function weatherText(code: number) {
  return WMO_WEATHER[code] ?? `天气代码 ${code}`;
}

function outdoorHint(input: {
  precipitationProbability: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  windSpeedMaxKmh: number | null;
}) {
  const { precipitationProbability, tempMaxC, tempMinC, windSpeedMaxKmh } = input;
  if (precipitationProbability !== null && precipitationProbability >= 60) return "降水概率较高，户外活动建议备雨具或改期";
  if (precipitationProbability !== null && precipitationProbability >= 30) return "可能有降水，出门前再确认天气";
  if (windSpeedMaxKmh !== null && windSpeedMaxKmh >= 39) return "风力较大，户外活动注意防风";
  if (tempMaxC !== null && tempMaxC >= 35) return "气温偏高，户外活动注意补水和避开正午";
  if (tempMinC !== null && tempMinC <= 0) return "气温较低，户外活动注意保暖";
  return "天气条件较平稳，可按自身情况安排户外活动";
}

function unavailable(provider: WeatherProvider, city: string, note: string): WeatherForecast {
  return {
    ok: false,
    provider,
    city: null,
    region: null,
    latitude: null,
    longitude: null,
    days: [],
    fetchedAt: new Date().toISOString(),
    note,
  };
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return (await response.json()) as T;
}

async function getOpenMeteoForecast(city: string, days: number): Promise<WeatherForecast> {
  const provider: WeatherProvider = "open-meteo";
  const geo = await requestJson<{
    results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }>;
  }>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`);
  const place = geo.results?.[0];
  if (!place) {
    return unavailable(provider, city, `没有找到城市「${city}」，请换一个更常见的城市名重试。`);
  }

  const forecast = await requestJson<{
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: Array<number | null>;
      wind_speed_10m_max: number[];
    };
  }>(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=${days}`);
  const daily = forecast.daily;
  if (!daily?.time?.length) {
    return unavailable(provider, city, "天气服务暂时没有返回可用的预报数据。");
  }

  const list: WeatherDay[] = daily.time.slice(0, days).map((date, index) => {
    const precipitationProbability = daily.precipitation_probability_max?.[index] ?? null;
    const tempMaxC = daily.temperature_2m_max?.[index] ?? null;
    const tempMinC = daily.temperature_2m_min?.[index] ?? null;
    const windSpeedMaxKmh = daily.wind_speed_10m_max?.[index] ?? null;
    return {
      date,
      weather: weatherText(daily.weather_code?.[index] ?? -1),
      tempMaxC,
      tempMinC,
      precipitationProbability,
      windText: windSpeedMaxKmh === null ? "暂无风速数据" : `最大风速 ${Math.round(windSpeedMaxKmh)} km/h`,
      windSpeedMaxKmh,
      outdoorHint: outdoorHint({ precipitationProbability, tempMaxC, tempMinC, windSpeedMaxKmh }),
    };
  });

  return {
    ok: true,
    provider,
    city: place.name,
    region: [place.admin1, place.country].filter(Boolean).join(" · ") || null,
    latitude: place.latitude,
    longitude: place.longitude,
    days: list,
    fetchedAt: new Date().toISOString(),
    note: "天气数据来自 Open-Meteo 实时预报；生活提示为一般性信息，不构成医疗或运动处方。",
  };
}

async function getAmapForecast(city: string, days: number, key: string): Promise<WeatherForecast> {
  const provider: WeatherProvider = "amap";
  const geo = await requestJson<{
    status: string;
    geocodes?: Array<{ province?: string; city?: string; adcode?: string; location?: string }>;
  }>(`https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(city)}&key=${encodeURIComponent(key)}`);
  const place = geo.geocodes?.[0];
  if (geo.status !== "1" || !place?.adcode) {
    return unavailable(provider, city, `没有找到城市「${city}」，请换一个更常见的城市名重试。`);
  }

  const weather = await requestJson<{
    status: string;
    forecasts?: Array<{
      city?: string;
      province?: string;
      casts?: Array<{
        date: string;
        dayweather: string;
        nightweather: string;
        daytemp: string;
        nighttemp: string;
        daywind: string;
        daypower: string;
      }>;
    }>;
  }>(`https://restapi.amap.com/v3/weather/weatherInfo?city=${encodeURIComponent(place.adcode)}&extensions=all&key=${encodeURIComponent(key)}`);
  const report = weather.forecasts?.[0];
  if (weather.status !== "1" || !report?.casts?.length) {
    return unavailable(provider, city, "天气服务暂时没有返回可用的预报数据。");
  }

  const [longitude, latitude] = (place.location ?? "").split(",").map((value) => Number(value));
  const list: WeatherDay[] = report.casts.slice(0, days).map((cast) => {
    const tempMaxC = Number.isFinite(Number(cast.daytemp)) ? Number(cast.daytemp) : null;
    const tempMinC = Number.isFinite(Number(cast.nighttemp)) ? Number(cast.nighttemp) : null;
    const weatherName = cast.dayweather === cast.nightweather ? cast.dayweather : `${cast.dayweather}转${cast.nightweather}`;
    const windDirection = cast.daywind.endsWith("风") ? cast.daywind : `${cast.daywind}风`;
    return {
      date: cast.date,
      weather: weatherName,
      tempMaxC,
      tempMinC,
      precipitationProbability: null,
      windText: `${windDirection} ${cast.daypower}级`,
      windSpeedMaxKmh: null,
      outdoorHint: outdoorHint({ precipitationProbability: null, tempMaxC, tempMinC, windSpeedMaxKmh: null }),
    };
  });

  return {
    ok: true,
    provider,
    city: report.city ?? place.city ?? city,
    region: report.province ?? place.province ?? null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    days: list,
    fetchedAt: new Date().toISOString(),
    note: "天气数据来自高德开放平台实时预报；生活提示为一般性信息，不构成医疗或运动处方。",
  };
}

export async function getWeatherForecast(city: string, days = 1): Promise<WeatherForecast> {
  const trimmedCity = city.trim();
  const safeDays = Math.min(3, Math.max(1, Math.round(days)));
  const key = `${trimmedCity}:${safeDays}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const amapKey = process.env.AMAP_KEY?.trim();
  const provider: WeatherProvider = amapKey ? "amap" : "open-meteo";
  let result: WeatherForecast;
  try {
    result = amapKey
      ? await getAmapForecast(trimmedCity, safeDays, amapKey)
      : await getOpenMeteoForecast(trimmedCity, safeDays);
  } catch {
    result = unavailable(provider, trimmedCity, "天气服务暂时不可用，请稍后再试；没有实时数据时不会给出天气结论。");
  }

  if (result.ok) cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}

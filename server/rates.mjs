export const DEFAULT_USD_RATE = 0.000749 // 1 USD ≈ 1,335 KRW

export function createRatesService({
  fetchRate = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    try {
      const res = await fetch(
        'https://api.frankfurter.dev/v1/latest?base=KRW&symbols=USD',
        { signal: controller.signal },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.rates?.USD && typeof data.rates.USD === 'number') {
        return Number(data.rates.USD)
      }
      throw new Error('Invalid rate payload')
    } finally {
      clearTimeout(timer)
    }
  },
  now = () => Date.now(),
} = {}) {
  let cache = {
    base: 'KRW',
    target: 'USD',
    rate: DEFAULT_USD_RATE,
    updatedAt: 0,
  }

  async function getRate() {
    const currentTime = now()
    if (
      currentTime - cache.updatedAt < 12 * 3600 * 1000 &&
      cache.updatedAt > 0
    ) {
      return cache
    }
    try {
      const rate = await fetchRate()
      cache = {
        base: 'KRW',
        target: 'USD',
        rate,
        updatedAt: currentTime,
      }
    } catch {
      if (cache.updatedAt === 0) {
        cache.updatedAt = currentTime
      }
    }
    return cache
  }

  return { getRate }
}


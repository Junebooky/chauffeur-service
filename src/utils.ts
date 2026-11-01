export const DEFAULT_USD_RATE = 0.000749

export const money = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)

export const moneyUsd = (amount: number, rate: number = DEFAULT_USD_RATE) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(amount * rate))
export const seoulDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export function tomorrow() {
  const d = new Date(`${seoulDate()}T12:00:00+09:00`)
  d.setUTCDate(d.getUTCDate() + 1)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
export function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

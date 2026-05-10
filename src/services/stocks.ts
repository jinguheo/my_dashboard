export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  prevClose: number
  isKRW: boolean
}

const BASE = 'https://finnhub.io/api/v1'

export async function fetchQuote(symbol: string, token: string): Promise<StockQuote> {
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`)
  if (!res.ok) throw new Error(`요청 실패: ${symbol}`)
  const d = await res.json()
  const isKRW = symbol.includes('.KS') || symbol.includes('.KQ')
  return {
    symbol,
    price: d.c,
    change: d.d ?? 0,
    changePercent: d.dp ?? 0,
    high: d.h,
    low: d.l,
    prevClose: d.pc,
    isKRW,
  }
}

export async function fetchWatchlist(symbols: string[], token: string): Promise<StockQuote[]> {
  const results = await Promise.allSettled(symbols.map(s => fetchQuote(s, token)))
  return results
    .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === 'fulfilled')
    .map(r => r.value)
}

export function fmtPrice(q: StockQuote): string {
  return q.isKRW
    ? q.price.toLocaleString('ko-KR') + '원'
    : '$' + q.price.toFixed(2)
}

export function fmtChange(q: StockQuote): string {
  const sign = q.change >= 0 ? '+' : ''
  const c = q.isKRW
    ? sign + q.change.toLocaleString('ko-KR')
    : sign + q.change.toFixed(2)
  return `${c} (${sign}${q.changePercent.toFixed(2)}%)`
}

export function displaySymbol(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/, '')
}

export interface StockQuote {
  symbol: string
  displayName?: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  prevClose: number
  isKRW: boolean
}

const BASE = 'https://finnhub.io/api/v1'

const KRW_INDEX_SYMBOLS = new Set(['^KS11', '^KQ11', '^KS200'])

function detectIsKRW(symbol: string): boolean {
  return symbol.includes('.KS') || symbol.includes('.KQ') || KRW_INDEX_SYMBOLS.has(symbol)
}

export async function fetchQuote(symbol: string, token: string): Promise<StockQuote> {
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`)
  if (!res.ok) throw new Error(`요청 실패: ${symbol}`)
  const d = await res.json()
  return {
    symbol,
    price: d.c,
    change: d.d ?? 0,
    changePercent: d.dp ?? 0,
    high: d.h,
    low: d.l,
    prevClose: d.pc,
    isKRW: detectIsKRW(symbol),
  }
}

export async function fetchWatchlist(symbols: string[], token: string): Promise<StockQuote[]> {
  const results = await Promise.allSettled(symbols.map(s => fetchQuote(s, token)))
  return results
    .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === 'fulfilled')
    .map(r => r.value)
}

export async function fetchWatchlistFromMcp(endpoint: string, symbols: string[]): Promise<StockQuote[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'stocks.watchlist',
        arguments: { symbols },
      },
    }),
  })
  if (!res.ok) throw new Error('MCP stock bridge request failed')
  const data = await res.json()
  const quotes = data?.result?.content?.[0]?.json ?? data?.result?.quotes ?? data?.quotes ?? data?.result
  if (!Array.isArray(quotes)) throw new Error('MCP response did not include quotes')
  return quotes as StockQuote[]
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

export function displaySymbol(q: StockQuote | string): string {
  if (typeof q === 'string') return q.replace(/\.(KS|KQ)$/, '').replace(/^\^/, '')
  return q.displayName || q.symbol.replace(/\.(KS|KQ)$/, '').replace(/^\^/, '')
}

// Map company names to their ticker symbols for stock price lookup
export function getCompanyTickers(companyName: string): string[] {
  const name = companyName.toLowerCase()
  
  // UBS - prioritize NYSE ticker (Alpha Vantage works better with simple tickers)
  if (name.includes('ubs')) {
    return ['UBS'] // NYSE ticker (Alpha Vantage supports this better than Swiss exchange)
  }
  
  // JPMorgan Chase
  if (name.includes('jp') || name.includes('jpmorgan') || name.includes('chase')) {
    return ['JPM']
  }
  
  // Morgan Stanley
  if (name.includes('morgan stanley')) {
    return ['MS']
  }
  
  // Goldman Sachs
  if (name.includes('goldman') || name.includes('gs')) {
    return ['GS']
  }
  
  // Bank of America
  if (name.includes('bank of america') || name.includes('bofa') || name.includes('bof')) {
    return ['BAC']
  }
  
  // Deutsche Bank
  if (name.includes('deutsche')) {
    return ['DB']
  }
  
  // Credit Suisse (now part of UBS but keeping for historical)
  if (name.includes('credit suisse')) {
    return ['CS']
  }
  
  // Default: try common ticker patterns
  // Extract uppercase letters as potential ticker
  const potentialTicker = companyName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4)
  if (potentialTicker.length >= 2) {
    return [potentialTicker]
  }
  
  // Fallback
  return []
}


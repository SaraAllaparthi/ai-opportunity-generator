// Currency formatting utility for CHF

export function formatCHF(amount: number): string {
  // Use Swiss format with apostrophes for thousands
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
    useGrouping: true // This uses apostrophes in Swiss format
  }).format(amount)
}

export function formatCHFWithDecimals(amount: number, decimals: number = 1): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount)
}


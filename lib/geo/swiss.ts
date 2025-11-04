// lib/geo/swiss.ts
export const SWISS_CANTONS: Record<string, string> = {
    tg: 'thurgau', thurgau: 'thurgau',
    zh: 'zürich', zurich: 'zürich', 'zürich': 'zürich',
    be: 'bern', bern: 'bern',
    bs: 'basel', basel: 'basel', 'basel-stadt': 'basel',
    bl: 'basel-landschaft', 'basel-landschaft': 'basel-landschaft',
    ge: 'geneva', geneva: 'geneva', 'genève': 'geneva',
    vd: 'vaud', vaud: 'vaud', lausanne: 'vaud',
    ag: 'aargau', aargau: 'aargau',
    sg: 'st. gallen', 'st. gallen': 'st. gallen', 'st gallen': 'st. gallen', 'sankt gallen': 'st. gallen',
    gr: 'graubünden', 'graubünden': 'graubünden', grisons: 'graubünden',
    vs: 'valais', valais: 'valais', wallis: 'valais',
    ti: 'ticino', ticino: 'ticino',
    ne: 'neuchâtel', 'neuchâtel': 'neuchâtel',
    sh: 'schaffhausen', schaffhausen: 'schaffhausen',
    ar: 'appenzell ausserrhoden', 'appenzell ausserrhoden': 'appenzell ausserrhoden',
    ai: 'appenzell innerrhoden', 'appenzell innerrhoden': 'appenzell innerrhoden',
    gl: 'glarus', glarus: 'glarus',
    sz: 'schwyz', schwyz: 'schwyz',
    ow: 'obwalden', obwalden: 'obwalden',
    nw: 'nidwalden', nidwalden: 'nidwalden',
    ur: 'uri', uri: 'uri',
    lu: 'luzern', luzern: 'luzern', lucerne: 'luzern',
    so: 'solothurn', solothurn: 'solothurn',
    ju: 'jura', jura: 'jura',
    fr: 'freiburg', freiburg: 'freiburg', fribourg: 'freiburg',
    zg: 'zug', zug: 'zug',
  }
  
  export function normalizeAndTokenize(location?: string): string[] {
    if (!location) return []
    return location
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[\s,/\|–-]+/)
      .filter(Boolean)
  }
  
  export function extractCityCantonCountry(hq?: string) {
    const t = normalizeAndTokenize(hq)
    let city: string | undefined
    let canton: string | undefined
    let country: 'switzerland' | 'germany' | 'austria' | undefined
  
    for (const token of t) {
      if (['switzerland', 'schweiz', 'suisse', 'ch'].includes(token)) country = 'switzerland'
      if (['germany', 'deutschland', 'de'].includes(token)) country = 'germany'
      if (['austria', 'österreich', 'at'].includes(token)) country = 'austria'
      const ck = token.toLowerCase()
      if (SWISS_CANTONS[ck]) canton = SWISS_CANTONS[ck]
    }
    // choose a “cityish” token (first non-country/non-canton)
    city = t.find(tok =>
      !['switzerland','schweiz','suisse','ch','germany','deutschland','de','austria','österreich','at'].includes(tok) &&
      !SWISS_CANTONS[tok]
    )
    return { city, canton, country }
  }
  
  export function geoScore(hqCompany?: string, hqPeer?: string) {
    if (!hqCompany || !hqPeer) return 0
    const c = extractCityCantonCountry(hqCompany)
    const pTok = normalizeAndTokenize(hqPeer)
  
    if (c.city && pTok.includes(c.city)) return 100
    if (c.canton && pTok.some(t => SWISS_CANTONS[t] === c.canton)) return 90
    if (c.country) {
      const variants: Record<string, string[]> = {
        switzerland: ['switzerland','schweiz','suisse','ch'],
        germany: ['germany','deutschland','de'],
        austria: ['austria','österreich','at']
      }
      if (pTok.some(t => variants[c.country!]?.includes(t))) return 80
    }
    const isDACH = (s: string[]) =>
      s.some(x => ['switzerland','schweiz','germany','deutschland','austria','österreich'].includes(x))
    if (isDACH(normalizeAndTokenize(hqCompany)) && isDACH(pTok)) return 60
    return 0
  }
  
  export function etld1(hostname: string) {
    const parts = hostname.toLowerCase().split('.')
    return parts.length >= 2 ? parts.slice(-2).join('.') : hostname.toLowerCase()
  }
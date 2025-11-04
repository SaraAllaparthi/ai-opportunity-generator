// app/api/competitors/types.ts
// Type definitions for competitor API

export type ApiCompetitor = {
  name: string
  website: string
  headquarters?: string
  country?: string
  size?: string | number
  ai_maturity?: string
  innovation_focus?: string
  positioning?: string
}

export type RequestBody = {
  company: {
    name: string
    headquarters?: string
    website?: string
  }
  industry?: {
    name?: string
  }
}

export type ApiResponse = {
  competitors: ApiCompetitor[]
}


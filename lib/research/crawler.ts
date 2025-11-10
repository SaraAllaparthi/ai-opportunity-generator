import * as cheerio from 'cheerio'
import { llmGenerateJson } from '@/lib/providers/llm'

export interface CrawledCompanyData {
  ceo?: string
  founded?: string
  size?: string
  headquarters?: string
  industry?: string
  businessDescription?: string
  products?: string[]
  services?: string[]
  keyCapabilities?: string[]
  targetMarkets?: string[]
  marketPosition?: string
  latestNews?: string
  pagesCrawled: string[]
}

/**
 * Crawl a company website to extract structured information
 */
export async function crawlCompanyWebsite(
  website: string,
  companyName: string
): Promise<CrawledCompanyData> {
  const result: CrawledCompanyData = {
    pagesCrawled: []
  }

  try {
    // Normalize website URL
    let baseUrl = website.trim()
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`
    }

    const urlObj = new URL(baseUrl)
    const domain = urlObj.origin

    // Pages to crawl (in priority order) - expanded for better CEO extraction
    const pagesToCrawl = [
      '', // Homepage
      '/about',
      '/company',
      '/about-us',
      '/aboutus',
      '/leadership',
      '/team',
      '/management',
      '/executives',
      '/our-team',
      '/who-we-are',
      '/people',
      '/board',
      '/board-of-directors',
      '/vorstand', // German: board/executive board
      '/geschaeftsfuehrung', // German: management
      '/services',
      '/products',
      '/what-we-do'
    ]

    const crawledPages: Array<{ url: string; content: string }> = []

    // Crawl pages in parallel (with timeout)
    const crawlPromises = pagesToCrawl.slice(0, 8).map(async (path) => {
      try {
        const pageUrl = `${domain}${path}`
        console.log(`[Crawler] Fetching: ${pageUrl}`)
        
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10s per page

        const response = await fetch(pageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AIOpportunityGenerator/1.0; +https://maverickaigroup.ai)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        })

        clearTimeout(timeout)

        if (!response.ok) {
          console.log(`[Crawler] Failed to fetch ${pageUrl}: ${response.status}`)
          return null
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        // Remove script and style tags
        $('script, style, noscript').remove()

        // Extract main content
        let content = ''
        
        // Try to find main content areas
        const mainSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.content',
          '.main-content',
          '#content',
          '#main',
          'body'
        ]

        for (const selector of mainSelectors) {
          const $main = $(selector).first()
          if ($main.length > 0) {
            content = $main.text()
            if (content.length > 500) break // Found substantial content
          }
        }

        // If no main content found, get body text
        if (content.length < 500) {
          content = $('body').text()
        }

        // Clean up content
        content = content
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, ' ')
          .trim()
          .substring(0, 10000) // Limit to 10k chars per page

        if (content.length > 200) {
          crawledPages.push({ url: pageUrl, content })
          result.pagesCrawled.push(pageUrl)
          console.log(`[Crawler] ✅ Crawled ${pageUrl} (${content.length} chars)`)
        }

        return { url: pageUrl, content }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log(`[Crawler] Timeout fetching page`)
        } else {
          console.log(`[Crawler] Error fetching page:`, err.message)
        }
        return null
      }
    })

    const results = await Promise.all(crawlPromises)
    const successfulPages = results.filter((r): r is { url: string; content: string } => r !== null)

    if (successfulPages.length === 0) {
      console.warn('[Crawler] No pages successfully crawled')
      return result
    }

    console.log(`[Crawler] Successfully crawled ${successfulPages.length} pages`)

    // Combine all page content
    const combinedContent = successfulPages
      .map(p => `=== ${p.url} ===\n${p.content}`)
      .join('\n\n')
      .substring(0, 50000) // Limit total content to 50k chars

    // Use LLM to extract structured information from crawled content
    const extractionPrompt = `Extract structured information about ${companyName} from the following website content crawled from ${domain}.

Website Content:
${combinedContent}

Extract the following information (ONLY if explicitly stated in the content):
1. CEO name - CRITICAL: Look carefully for CEO information. Search for:
   - "Group CEO", "CEO", "Chief Executive Officer", "Geschäftsführer", "Managing Director" followed by a person's full name
   - Patterns like: "John Smith, Group CEO" or "Group CEO: John Smith" or "John Smith, CEO" or "CEO John Smith"
   - Look in leadership sections, team pages, about pages, management sections
   - Return ONLY the full name (first name + last name) if found, not just the title
   - Priority: Group CEO > CEO > Chief Executive Officer > Geschäftsführer > Managing Director
2. Founded year - Look for "founded", "established", "incorporated", "registered" followed by a year (YYYY). Return in format "Founded in YYYY" if found.
3. Company size - Look for "employees", "employee count", "workforce", "headcount", "Mitarbeiter" followed by a number. Return in format "X employees" or "X-Y employees" if found.
4. Headquarters - Look for location information (city, country). Return in format "City, Country" if found.
5. Industry - Primary industry sector if explicitly stated.
6. Business description - What the company does, its core business model (2-3 sentences).
7. Products - List of main products if mentioned (array of strings).
8. Services - List of main services if mentioned (array of strings).
9. Key capabilities - Key capabilities or strengths if mentioned (array of strings).
10. Target markets - Target markets or customer segments if mentioned (array of strings).
11. Market position - Market position or leadership info if mentioned.
12. Latest news - One recent news point or announcement if mentioned.

CRITICAL REQUIREMENTS:
- ONLY extract information that is EXPLICITLY stated in the content
- Do NOT infer, estimate, or guess
- If information is not found, omit the field (return null or undefined)
- CEO: Must be a real name (not "John Doe" or placeholder), must have at least 2 words
- Founded: Must be a specific year (1900-2099)
- Size: Must contain explicit employee count with numbers

Return your response as a JSON object with these exact keys:
{
  "ceo": "string or null",
  "founded": "string or null",
  "size": "string or null",
  "headquarters": "string or null",
  "industry": "string or null",
  "businessDescription": "string or null",
  "products": ["string"] or null,
  "services": ["string"] or null,
  "keyCapabilities": ["string"] or null,
  "targetMarkets": ["string"] or null,
  "marketPosition": "string or null",
  "latestNews": "string or null"
}`

    const systemPrompt = `You are a data extraction assistant. Extract ONLY factual information that is explicitly stated in the provided website content. Do NOT infer, estimate, or guess. Return valid JSON only.`

    try {
      const extracted = await llmGenerateJson(systemPrompt, extractionPrompt, {
        timeoutMs: 30000
      })

      console.log('[Crawler] Extracted data from website:', {
        ceo: extracted.ceo ? 'Found' : 'Not found',
        founded: extracted.founded ? 'Found' : 'Not found',
        size: extracted.size ? 'Found' : 'Not found',
        headquarters: extracted.headquarters ? 'Found' : 'Not found',
        industry: extracted.industry ? 'Found' : 'Not found',
        businessDescription: extracted.businessDescription ? 'Found' : 'Not found'
      })

      // Validate and assign extracted data
      if (extracted.ceo && typeof extracted.ceo === 'string' && extracted.ceo.trim().length > 0) {
        const ceoName = extracted.ceo.trim()
        // Reject placeholder names
        const lowerName = ceoName.toLowerCase()
        if (!lowerName.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i) &&
            ceoName.split(/\s+/).length >= 2) {
          result.ceo = ceoName
        }
      }

      if (extracted.founded && typeof extracted.founded === 'string') {
        const yearMatch = extracted.founded.match(/\b(19|20)\d{2}\b/)
        if (yearMatch) {
          result.founded = `Founded in ${yearMatch[0]}`
        }
      }

      if (extracted.size && typeof extracted.size === 'string') {
        const sizeStr = extracted.size.toLowerCase()
        if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          result.size = extracted.size.trim()
        }
      }

      if (extracted.headquarters && typeof extracted.headquarters === 'string' && extracted.headquarters.trim()) {
        result.headquarters = extracted.headquarters.trim()
      }

      if (extracted.industry && typeof extracted.industry === 'string' && extracted.industry.trim()) {
        result.industry = extracted.industry.trim()
      }

      if (extracted.businessDescription && typeof extracted.businessDescription === 'string' && extracted.businessDescription.trim()) {
        result.businessDescription = extracted.businessDescription.trim()
      }

      if (extracted.products && Array.isArray(extracted.products)) {
        result.products = extracted.products.filter((p: any) => typeof p === 'string' && p.trim()).map((p: string) => p.trim())
      }

      if (extracted.services && Array.isArray(extracted.services)) {
        result.services = extracted.services.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
      }

      if (extracted.keyCapabilities && Array.isArray(extracted.keyCapabilities)) {
        result.keyCapabilities = extracted.keyCapabilities.filter((c: any) => typeof c === 'string' && c.trim()).map((c: string) => c.trim())
      }

      if (extracted.targetMarkets && Array.isArray(extracted.targetMarkets)) {
        result.targetMarkets = extracted.targetMarkets.filter((m: any) => typeof m === 'string' && m.trim()).map((m: string) => m.trim())
      }

      if (extracted.marketPosition && typeof extracted.marketPosition === 'string' && extracted.marketPosition.trim()) {
        result.marketPosition = extracted.marketPosition.trim()
      }

      if (extracted.latestNews && typeof extracted.latestNews === 'string' && extracted.latestNews.trim()) {
        result.latestNews = extracted.latestNews.trim()
      }

    } catch (err) {
      console.error('[Crawler] Failed to extract structured data:', err)
    }

    return result
  } catch (err) {
    console.error('[Crawler] Error crawling website:', err)
    return result
  }
}


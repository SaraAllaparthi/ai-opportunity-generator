# Database Migrations

## Briefs Table

✅ **Table Created** - The `briefs` table stores AI Opportunity Briefs in Supabase.

The table structure:
```sql
CREATE TABLE IF NOT EXISTS public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_briefs_share_slug ON briefs(share_slug);
CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON briefs(created_at);
```

### Data Structure (JSONB)

The `data` column stores a JSONB object matching the `Brief` schema. Key structure:

```typescript
{
  company: {
    name: string
    website: string
    summary: string (min 100 chars)
    size?: string
    industry?: string
    headquarters?: string
    founded?: string
    ceo?: string
    market_position?: string
    latest_news?: string
  },
  industry: {
    summary: string (20-300 chars)
    trends: string[] (4-6 items, max 200 chars each)
  },
  competitors: Array<{
    name: string (required)
    website: string (required, valid URL)
    hq?: string ("City, Country")
    size_band?: string (e.g., "50-250 employees")
    positioning?: string (max 140 chars)
    evidence_pages: string[] (min 1 URL, prefer 2)
    source_url?: string (valid URL)
  }> (0-6 competitors),
  use_cases: Array<{...}> (exactly 5),
  strategic_moves: Array<{...}> (3-5),
  citations: string[] (URLs),
  roi?: {...}
}
```

### Competitor Data Validation

The `competitors` array is stored as JSONB and must match the schema:
- **Required fields**: `name`, `website`, `evidence_pages` (min 1 URL)
- **Optional fields**: `hq`, `size_band`, `positioning`, `source_url`
- **Array limits**: 0-6 competitors (prefer 2-3)
- **URL validation**: All URLs must be valid (website, evidence_pages, source_url)

### JSONB Benefits

- **Flexible Schema**: JSONB allows storing nested structures without rigid table columns
- **Query Support**: PostgreSQL JSONB supports queries like `data->'competitors'->0->>'name'`
- **Indexing**: Can create GIN indexes on JSONB columns for fast searches
- **Validation**: Application-level validation via Zod ensures data integrity

### Optional: JSONB Indexes for Competitors

For faster competitor queries, you can add a GIN index:

```sql
-- Index for searching competitors by name
CREATE INDEX IF NOT EXISTS idx_briefs_competitors_name 
ON briefs USING GIN ((data->'competitors'));

-- Index for filtering by company name
CREATE INDEX IF NOT EXISTS idx_briefs_company_name 
ON briefs USING GIN ((data->'company'->>'name'));
```

## Research Cache Table

✅ **Table Created** - The `research_cache` table has been created in Supabase.

The table structure:
```sql
CREATE TABLE IF NOT EXISTS research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_cache_key ON research_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_research_cache_created_at ON research_cache(created_at);
```

### How It Works

- **Cache Key Format**: `perplexity:{type}:{companyName}|{website}|{industry}`
  - Types: `dossier`, `competitors`, `industry`
- **TTL**: 24 hours (automatically expired and deleted when accessed)
- **Upsert**: Uses `onConflict: 'cache_key'` to update existing entries

### Optional: Cleanup Job

You can optionally set up a scheduled job in Supabase to clean up expired entries:

```sql
-- Delete entries older than 24 hours
DELETE FROM research_cache 
WHERE created_at < NOW() - INTERVAL '24 hours';
```

Or use Supabase's pg_cron extension for automatic cleanup.

### Benefits

- **Reduced API Costs**: Perplexity responses cached for 24 hours
- **Faster Response Times**: Subsequent requests for same company use cached data
- **Automatic Expiration**: Old cache entries are automatically removed

The cache table stores Perplexity research responses with a 24-hour TTL to reduce API costs and improve response times.

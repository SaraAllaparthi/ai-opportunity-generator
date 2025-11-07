# Database Migrations

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


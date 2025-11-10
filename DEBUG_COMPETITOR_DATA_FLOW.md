# Debugging Competitor Data Flow

## Database Schema
✅ **No schema changes needed** - The `briefs` table uses JSONB which supports the competitors array structure.

## Data Flow Path

1. **Pipeline** (`lib/research/pipeline.ts`)
   - `findLocalCompetitors()` finds competitors
   - Maps to `parsed.competitors` array
   - Validates and saves to database via `createBrief()`

2. **Database** (`lib/db/briefs.ts`)
   - Stores in JSONB `data` column
   - Validates competitor structure before saving
   - Logs competitor count when saving

3. **Retrieval** (`lib/db/briefs.ts`)
   - `getBriefBySlug()` fetches from database
   - Returns `BriefRow` with `data: Brief` property
   - Logs competitor count when reading

4. **Page** (`app/share/[slug]/page.tsx`)
   - Gets brief from database
   - Passes `data={brief.data}` to components
   - Logs competitor data before rendering

5. **Component** (`components/CompetitorComparison.tsx`)
   - Receives `data: Brief` prop
   - Filters: `(data.competitors || []).filter(c => c && c.name && c.name.trim()).slice(0, 3)`
   - Returns `null` if `!hasCompetitors`

## Testing Tools

### 1. API Endpoint Test
```bash
# Test a specific brief slug
curl "http://localhost:3000/api/test-competitors?slug=YOUR_SLUG"
```

This will show:
- Competitor count in database
- Filtered competitors
- Whether component will render

### 2. Server Logs
Check server console for:
- `[SharePage] Rendering page with data:` - Shows what data is passed to component
- `[DB] Retrieved brief from database:` - Shows what's in the database
- `[Pipeline] Final brief structure:` - Shows what pipeline created

### 3. Component Logs (Browser Console)
Check browser console (F12) for:
- `[CompetitorComparison] Component rendering with data:` - Shows what component receives
- `[CompetitorComparison] Filtered competitors:` - Shows filtering results

## Common Issues

### Issue 1: No Competitors in Database
**Symptoms:** `[SharePage] Competitors count: 0`
**Root Cause:** Pipeline didn't find competitors or they were filtered out
**Solution:** Check pipeline logs for `findLocalCompetitors` results

### Issue 2: Competitors in DB but Component Blank
**Symptoms:** Database has competitors, but component shows nothing
**Root Cause:** Component filtering is removing all competitors
**Solution:** Check `[CompetitorComparison] Filtered competitors` log

### Issue 3: Component Not Receiving Data
**Symptoms:** Component logs show `hasData: false` or `competitorsCount: 0`
**Root Cause:** Data not being passed correctly from page to component
**Solution:** Check `[SharePage]` logs to see what's being passed

## Quick Fix Checklist

- [ ] Check server logs for `[SharePage]` - are competitors present?
- [ ] Check browser console for `[CompetitorComparison]` - is component receiving data?
- [ ] Test API endpoint: `/api/test-competitors?slug=YOUR_SLUG`
- [ ] Verify database has competitors: Check Supabase dashboard
- [ ] Check if competitors pass validation in pipeline

## Schema Verification

The schema is correct - no changes needed:
- `briefs.data` is JSONB (supports nested arrays)
- `competitors` array structure matches schema
- All required fields are validated before saving


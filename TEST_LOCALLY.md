# Testing Locally

## 1. Set Up Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp env.example .env.local
```

Then edit `.env.local` and add your actual API keys:

```env
# Required API Keys
PERPLEXITY_API_KEY="your-actual-perplexity-key"
OPENAI_API_KEY="your-actual-openai-key"
TAVILY_API_KEY="your-actual-tavily-key"

# Database (Required)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional
PERPLEXITY_MODEL="sonar-pro"
OPENAI_MODEL="gpt-4o-mini"
RESEARCH_REGION="CH"
ENABLE_ANALYTICS="0"
```

## 2. Install Dependencies (if not already done)

```bash
npm install
```

## 3. Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 4. Test the Application

### Option A: Test via Web UI
1. Open `http://localhost:3000` in your browser
2. Fill in the form:
   - Company Name: e.g., "Acme Corporation"
   - Website URL: e.g., "https://example.com"
   - Industry: Select an industry from the dropdown
3. Click "Generate AI Insights"
4. Watch the terminal/console for logs

### Option B: Test via API Directly

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corporation",
    "website": "https://example.com",
    "industryHint": "Technology"
  }'
```

## 5. Check Logs

Watch the terminal where `npm run dev` is running. You should see:

- `[API] Request received:` - Confirms the request was received
- `[Pipeline] Starting research pipeline` - Pipeline started
- `[Tavily] Sending search request` - Tavily searches
- `[Pipeline] LLM attempt` - LLM calls
- `[API] Brief generated successfully` - Success!
- Or error messages if something fails

## 6. Common Issues

### Missing API Keys
If you see "Missing TAVILY_API_KEY" or similar:
- Check that `.env.local` exists and has all required keys
- Restart the dev server after adding keys

### Timeout Errors
- The pipeline can take 60-90 seconds
- If it times out, check your API keys are valid

### Validation Errors
- Check the terminal logs for specific validation errors
- The error will show which field failed validation

## 7. View Generated Brief

After successful generation, you'll be redirected to:
`http://localhost:3000/share/[slug]`

Or you can check the response from the API call which includes the `shareSlug`.

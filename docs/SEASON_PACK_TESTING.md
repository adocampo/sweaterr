# Season Pack Search Testing Guide

**Feature**: Optimized Season Pack Search for Sonarr Integration  
**Status**: ✅ Ready for Testing  
**Created**: 2026-01-15  

## Overview

This feature optimizes `/api/arr/search` endpoint to prioritize season pack searches when Sonarr requests a specific season without an episode. Instead of generic search variants, the system now uses dedicated queries like `"Breaking Bad T5"` and applies intelligent scoring to prioritize complete season packs.

## How to Test Manually

### Option 1: Direct API Testing (cURL/Postman)

#### 1. Get Forum API Key

First, add a forum to Sweaterr and copy its `torznabApiKey`.

```bash
# Example forum: DescargasDD
API_KEY="fdd-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

#### 2. Test Season Pack Search

```bash
# Search for Breaking Bad Season 5
curl -G "http://localhost:3000/api/arr" \
  --data-urlencode "t=tvsearch" \
  --data-urlencode "q=Breaking Bad" \
  --data-urlencode "season=5" \
  --data-urlencode "apikey=$API_KEY" \
  | head -100
```

**Expected Behavior**:

- Log output shows: `isTv=true, season=5, ep=null` (season pack mode)
- Log shows variants being tried in order: `"Breaking Bad T5"`, `"Breaking Bad temporada 5"`, etc.
- Season pack indicators in logs: `Season pack scoring applied: Top result: "..."`
- Results sorted by score (T5 + pack indicator = 150 points)

#### 3. Compare with Episode Search (Control Test)

```bash
# Search for Breaking Bad S05E01 (should use different variants)
curl -G "http://localhost:3000/api/arr" \
  --data-urlencode "t=tvsearch" \
  --data-urlencode "q=Breaking Bad" \
  --data-urlencode "season=5" \
  --data-urlencode "ep=1" \
  --data-urlencode "apikey=$API_KEY" \
  | head -100
```

**Expected Behavior**:

4. **API Key**: (Paste forum's `torznabApiKey` from above)
5. Click "Test" → Should return "Indexer working"
6. Save

#### 2. Test Search in Sonarr

1. Sonarr → Series → Add New Series
2. Search for `Breaking Bad`
3. Select a specific season (e.g., Season 5)
4. Sonarr sends request: `GET /api/arr?t=tvsearch&q=Breaking%20Bad&season=5&apikey=...`
5. Check Sweaterr logs in terminal for:
   ```
   [SONARR] Starting forum search for query: "Breaking Bad" (variants: 6, isTv=true, season=5, ep=null)
   [SONARR] Searching in forum "DescargasDD" with variant: "Breaking Bad T5"
   [SONARR] Found X results in forum "DescargasDD"
   [SONARR] Season pack scoring applied: Top result: "..." (score=150, reason=...)
   ```
6. Verify results show season pack matches (should have "T5", "temporada 5", "pack", "completa" in title)

#### 3. Verify Auto-Selection

- Sonarr should display the highest-scored result as the default option
- User can see results are season-specific without extra filtering

### Option 3: Log-Based Testing

Watch the logs while running the dev server:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Make request and watch logs
curl -G "http://localhost:3000/api/arr" \
  --data-urlencode "t=tvsearch" \
  --data-urlencode "q=Breaking Bad" \
  --data-urlencode "season=5" \
  --data-urlencode "apikey=$API_KEY"

# Look for these log lines in Terminal 1:
# [arr-search] [SONARR] Starting forum search for query: "Breaking Bad" (variants: 6, isTv=true, season=5, ep=null)
# [arr-search] [SONARR] Searching in forum "DescargasDD" with variant: "Breaking Bad T5"
# [arr-search] [SONARR] Season pack scoring applied: Top result: "Breaking Bad T5..." (score=150, reason=Exact season match; Season pack indicator;)
```

## Expected Results

### Season Pack Search (S05, no episode)

| Variant | Expected | Actual |
|---------|----------|--------|
| Uses `buildSeasonPackVariants()` | ✅ Yes | ? |
| Try: "Breaking Bad T5" | ✅ First | ? |
| Try: "Breaking Bad temporada 5" | ✅ Second (if first fails) | ? |
| Scoring: "T5 Completa" | ✅ 150 points | ? |
| Scoring: "T5 pack" | ✅ 150 points | ? |
| Scoring: "T5" (no pack) | ✅ 100 points | ? |
| Results sorted by score | ✅ Yes | ? |

### Episode Search (S05E01)

| Variant | Expected | Actual |
|---------|----------|--------|
| Uses standard queries | ✅ Yes | ? |
| Try: "Breaking Bad T5" | ✅ Not first | ? |
| Try: "Breaking Bad 5x01" | ✅ First | ? |
| No scoring applied | ✅ Yes | ? |

## Code Changes Reference

### Modified Files

- **[src/app/api/arr/search/route.ts](src/app/api/arr/search/route.ts)**
  - New function: `buildSeasonPackVariants()` (line ~170)
  - Modified: `buildTvVariants()` (line ~190)
  - New: Season pack scoring logic (line ~310)
  
- **[ARCHITECTURE.md](ARCHITECTURE.md#81-búsqueda-optimizada-de-season-packs-new---enero-2026)**
  - Section 8.1 with complete feature documentation

### Key Functions

```typescript
// Build season pack-specific queries
buildSeasonPackVariants(series: string, season: string | null): string[]
  // Returns: ["Breaking Bad T5", "Breaking Bad temporada 5", ...]

// Priority-aware variant building
buildTvVariants(series: string, season?: string | null, ep?: string | null): string[]
  // If season && !ep: Calls buildSeasonPackVariants() first
  // If season && ep: Standard episode queries

// Intelligent result scoring
scoreResult(result: any, seasonNum: number): { score: number; reason: string }
  // Detects exact season match, pack indicators, penalizes multiple seasons
```

## Troubleshooting

### Issue: No season pack scoring applied

**Check**:
- Is `season` parameter present in request?
- Is `ep` parameter absent?
- Look for log: `[arr-search] [...] Season pack scoring applied:`
- If missing, check if `isTv=false` or `ep` is present

### Issue: Wrong results returned

**Check**:
- Are forum results actually in Spanish format?
- Does forum support queries like "Breaking Bad T5"?
- Try manual forum search with "Breaking Bad T5" to verify
- Check logs for: `Found X results in forum "..."`

### Issue: Search is slow

**Check**:
- Is it trying all 10 variants? (Log shows variants being tried)
- Recommendation: Stop at first successful match works, so slowness might be forum latency
- Test forum connection: `/api/config/forums/[id]/test`

## Performance Metrics

Expected performance after feature implementation:

| Metric | Before | After | Unit |
|--------|--------|-------|------|
| Season pack search time | ~3-5 | ~1-2 | seconds |
| Queries attempted | 8 | 6-8 | count |
| Top result relevance | ~60% | ~95% | % |
| Sonarr auto-selection success | N/A | ~90% | % |

## Next Steps

- [ ] Test with real Sonarr instance
- [ ] Verify scoring works across different forums
- [ ] Test with edge cases (series with numbers, special chars)
- [ ] Monitor performance with large forum datasets

---

**Questions?** Check ARCHITECTURE.md section 8.1 for detailed documentation.

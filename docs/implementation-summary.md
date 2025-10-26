# Studio Filtering - Implementation Summary

## Research Complete

Created comprehensive research document at `/docs/tmdb-studio-filtering-deep-dive.md` covering:

### Key Findings
1. **Root Cause**: TMDB's `with_companies` parameter is BROAD - includes production, co-production, distribution, etc.
2. **No Direct Alternative**: TMDB doesn't provide a "primary studio only" endpoint
3. **Multiple Solutions Evaluated**: 4 different approaches analyzed with pros/cons

### Recommended Solution: Phase 1 + 2 (Multi-Page Fetch)

## Changes Implemented

### 1. Basic "All Movies" Endpoint - Multi-Page Strategy
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId`

**Strategy**:
- Fetches 2 pages simultaneously (40 results)
- Merges and deduplicates
- Returns top 20 unique results
- Most permissive filters:
  - `voteCountGte: '5'` (very low threshold)
  - `excludeKeywords: '99'` (only documentaries)
  - No runtime filter (allows all movie lengths)

**Expected Results**: 18-20 movies per slider

### 2. Trending Endpoint - Updated Filters
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId/trending`

**Filters Applied**:
```typescript
{
  sortBy: 'popularity.desc',
  primaryReleaseDateLte: today,
  voteCountGte: '30',         // Lowered from 50
  withRuntimeGte: '60',       // Exclude shorts
  excludeKeywords: '99,10692' // Block docs + concerts
}
```

**Expected Results**: 12-15 movies per slider

### 3. New Releases Endpoint - Updated Filters
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId/new`

**Filters Applied**:
```typescript
{
  sortBy: 'primary_release_date.desc',
  primaryReleaseDateGte: '90 days ago',
  primaryReleaseDateLte: today,
  voteCountGte: '30',         // Lowered from 50
  withRuntimeGte: '60',       // Exclude shorts
  excludeKeywords: '99,10692' // Block docs + concerts
}
```

**Expected Results**: 8-12 movies per slider (smaller time window)

### 4. Popular Endpoint - Updated Filters
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId/popular`

**Filters Applied**:
```typescript
{
  sortBy: 'popularity.desc',
  voteCountGte: '30',         // Lowered from 50
  withRuntimeGte: '60',       // Exclude shorts
  excludeKeywords: '99,10692' // Block docs + concerts
}
```

**Expected Results**: 12-15 movies per slider

### 5. Top Rated Endpoint - Updated Filters
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId/top-rated`

**Filters Applied**:
```typescript
{
  sortBy: 'vote_average.desc',
  voteCountGte: '100',        // KEPT HIGH for quality
  withRuntimeGte: '60',       // Exclude shorts
  excludeKeywords: '99,10692' // Block docs + concerts
}
```

**Expected Results**: 8-12 movies per slider (quality over quantity)

### 6. Genre Endpoint - Updated Filters
**File**: `server/routes/discover.ts` - `/movies/studio/:studioId/genre/:genreId`

**Filters Applied**:
```typescript
{
  genre: genreId,
  sortBy: 'popularity.desc',
  voteCountGte: '30',         // Lowered from 50
  withRuntimeGte: '60',       // Exclude shorts
  excludeKeywords: '99,10692' // Block docs + concerts
}
```

**Expected Results**: 10-15 movies per slider

## Filter Strategy Summary

### Tiered Approach by Slider Type

| Slider Type | Vote Threshold | Runtime Filter | Keyword Exclusions | Special Strategy |
|------------|---------------|----------------|-------------------|-----------------|
| **All Movies** | 5 | None | Docs only (99) | Multi-page fetch |
| **Trending** | 30 | 60 min+ | Docs + Concerts | Standard |
| **New** | 30 | 60 min+ | Docs + Concerts | 90-day window |
| **Popular** | 30 | 60 min+ | Docs + Concerts | Standard |
| **Top Rated** | 100 | 60 min+ | Docs + Concerts | Quality focus |
| **Genre** | 30 | 60 min+ | Docs + Concerts | Standard |

### Keyword IDs Used
- `99` - Documentary
- `10692` - Concert Film
- `158431` - Stand-up Comedy (not currently used, available for future)

## Expected Improvements

### Before (with aggressive filtering)
- All Movies: 2-10 results
- Genre sliders: 2-5 results
- Top Rated: 2-3 results

### After (with optimized filtering)
- All Movies: **18-20 results** (multi-page fetch)
- Trending/Popular: **12-15 results**
- Genre sliders: **10-15 results**
- New Releases: **8-12 results**
- Top Rated: **8-12 results**

## Testing Checklist

Once server restarts, test these scenarios:

### Netflix (Company ID: 2354)
- [ ] All Movies slider shows 18-20 items
- [ ] Trending shows 12-15 items
- [ ] Comedy genre shows 10-15 items
- [ ] Top Rated shows 8-12 items

### HBO (Company ID: 3268)
- [ ] All Movies slider shows 18-20 items
- [ ] Drama genre shows 10-15 items

### Smaller Studio (e.g., A24 - 41077)
- [ ] Results proportional to catalog size
- [ ] At least 5-10 in All Movies
- [ ] May have fewer in genres (expected)

### Performance
- [ ] Page loads in < 2 seconds
- [ ] No console errors
- [ ] Pagination works correctly

## Future Optimization Opportunities

### Phase 3: Verification Layer (Optional)
If results still contain too many false positives:
- Add optional `verifyPrimaryStudio` flag
- Fetch movie details to check `production_companies[0]`
- Verify primary studio role
- Cache results to minimize API calls

### Phase 4: Background Caching
For popular studios (Netflix, Disney, HBO, etc.):
- Pre-cache results via background job
- Refresh daily
- Serve from cache for instant response
- Fallback to discover API if cache miss

### Phase 5: User Preferences
Allow users to choose filtering strictness:
- **Relaxed**: All company involvement (current)
- **Balanced**: Primary + co-production
- **Strict**: Primary production only (requires verification)

## API Call Analysis

### Before
- 1 request per slider
- 6 requests total per network page

### After
- 2-3 requests per slider (All Movies endpoint)
- 1 request per other sliders
- ~8 requests total per network page
- Still well under rate limit (50/sec, 20/window)

## Documentation Created

1. **`docs/tmdb-studio-filtering-deep-dive.md`** - Comprehensive research
   - Problem analysis
   - 4 solution approaches evaluated
   - TMDB API constraints
   - Implementation phases
   - Testing strategy

2. **`docs/filtering-strategy-research.md`** - Original filter research
   - Parameter analysis
   - Keyword IDs
   - 4-tier filtering strategies

3. **`docs/network-company-mapping.md`** - ID mapping guide
   - Network to company ID mappings
   - How to find new IDs
   - Validation instructions

## Next Steps

1. **Test Results**: Check Netflix page once server is up
2. **Monitor**: Watch console for errors or warnings
3. **Iterate**: If still insufficient, proceed to Phase 3 (verification)
4. **Document**: Update mappings if new networks added

## Configuration Summary

All changes are in `server/routes/discover.ts`:
- Lines 348-418: All Movies endpoint (multi-page)
- Lines 420-476: Trending endpoint (updated filters)
- Lines 478-547: New releases endpoint (updated filters)
- Lines 549-603: Popular endpoint (updated filters)
- Lines 605-661: Top Rated endpoint (updated filters)
- Lines 663-716: Genre endpoint (updated filters)

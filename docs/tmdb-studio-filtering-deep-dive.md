# TMDB Studio/Company Filtering - Deep Dive Research

## Problem Statement
We're getting limited results (2-10 movies per slider) when filtering by studio/production company using TMDB's `with_companies` parameter in the Discover API. Need to find alternative approaches or optimizations.

## Current Implementation Analysis

### What We're Using
- **Endpoint**: `/discover/movie` with `with_companies` parameter
- **Current Filters**:
  - `with_companies`: {companyId}
  - `sort_by`: varies (popularity.desc, release_date.desc, vote_average.desc)
  - `vote_count.gte`: 30-100 (depending on slider)
  - `with_runtime.gte`: 60 (exclude shorts)
  - `without_keywords`: 99,10692 (exclude docs/concerts)
  - `primary_release_date.lte`: today (no unreleased)

### The Core Issue
**TMDB's `with_companies` parameter is BROAD** - it returns ANY movie where the company is involved in ANY capacity:
- Main production company ✓
- Co-production company ✓
- Distribution company ✓
- Secondary production ✓
- International distribution ✓

This creates false positives and unreliable filtering.

## Alternative Approaches from TMDB Documentation

### 1. ❌ Keyword-Based Filtering (Not Viable)
**Endpoint**: `/keyword/{keyword_id}/movies`

**Why it doesn't help**:
- Keywords are for content themes (e.g., "superhero", "romance")
- Not for companies/studios
- Would require creating custom keyword mappings
- Not how TMDB structures data

### 2. ❌ Company Details Endpoint (Read-Only)
**Endpoint**: `/company/{company_id}`

**What it provides**:
- Company name, logo, headquarters
- Alternative names
- Company images
- **NO movie list**

**Why it doesn't help**:
- Only gives company metadata
- Doesn't provide related movies

### 3. ✅ Discover API with AND/OR Logic (Current Approach - Optimizable)
**Key Finding from Docs**: 
> "A number of filters support being comma (`,`) or pipe (`|`) separated. Comma's are treated like an `AND` query while pipe's are treated like an `OR`."

**Current Status**: We're already using this
**Optimization Opportunity**: Combine multiple studios using pipes

Example:
```
with_companies=2354|3268|20580  // Netflix OR HBO OR Amazon
```

### 4. ✅ Multiple API Calls with Aggregation (Viable)
Instead of relying on TMDB filtering, make multiple calls and aggregate client-side.

**Approach**:
- Call `/discover/movie` with broader filters
- Fetch individual movie details for verification
- Check `production_companies` array in movie details
- Filter for PRIMARY production company

**Endpoint**: `/movie/{movie_id}`
Returns:
```json
{
  "production_companies": [
    {
      "id": 2354,
      "logo_path": "/...",
      "name": "Netflix",
      "origin_country": "US"
    }
  ]
}
```

## Proposed Solutions

### Solution A: Hybrid Filtering (Quick Implementation)
**Keep discover API, add smarter sorting and pagination**

```typescript
// 1. Lower vote threshold even more for initial fetch
voteCountGte: '10' // Get more candidates

// 2. Fetch more pages
const promises = [1, 2, 3].map(page => 
  tmdb.getDiscoverMovies({ ...options, page })
);

// 3. Aggregate and sort client-side
const allResults = (await Promise.all(promises))
  .flatMap(data => data.results)
  .slice(0, 20); // Take top 20
```

**Pros**:
- Quick to implement
- Uses existing infrastructure
- Gets more results

**Cons**:
- Still relies on unreliable `with_companies`
- More API calls
- May still have false positives

### Solution B: Verification Layer (Most Accurate)
**Fetch discover results, then verify via movie details**

```typescript
async function getVerifiedStudioMovies(studioId: number, options: any) {
  // 1. Get candidates from discover
  const discoverData = await tmdb.getDiscoverMovies({
    studio: studioId,
    page: 1,
    voteCountGte: '10', // Cast wider net
    ...options
  });

  // 2. Verify each movie's PRIMARY production company
  const verifiedResults = await Promise.all(
    discoverData.results.slice(0, 30).map(async (movie) => {
      const details = await tmdb.getMovieDetails({ movieId: movie.id });
      
      // Check if studio is PRIMARY (usually first in array)
      const isPrimaryStudio = details.production_companies[0]?.id === studioId;
      
      return isPrimaryStudio ? movie : null;
    })
  );

  // 3. Filter out nulls and return verified movies
  return verifiedResults.filter(Boolean).slice(0, 20);
}
```

**Pros**:
- Most accurate results
- Guarantees PRIMARY production company
- Can identify distribution-only vs production

**Cons**:
- Many more API calls (30+ per slider)
- Rate limiting concerns
- Slower performance
- Caching essential

### Solution C: Smart Caching + Batching (Best Long-Term)
**Pre-fetch and cache studio movies, serve from cache**

```typescript
// Background job runs periodically
async function cacheStudioMovies(studioId: number) {
  const allMovies = [];
  
  // Fetch multiple pages
  for (let page = 1; page <= 5; page++) {
    const data = await tmdb.getDiscoverMovies({
      studio: studioId,
      page,
      voteCountGte: '5', // Very broad
    });
    allMovies.push(...data.results);
  }
  
  // Batch verify in chunks
  const chunks = chunkArray(allMovies, 20);
  const verified = [];
  
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(movie => verifyStudio(movie.id, studioId))
    );
    verified.push(...results.filter(Boolean));
    
    // Rate limit pause
    await sleep(1000);
  }
  
  // Cache for 24 hours
  await cache.set(`studio:${studioId}:movies`, verified, 86400);
  
  return verified;
}

// Endpoint serves from cache
async function getStudioMovies(studioId: number, sortBy: string) {
  const cached = await cache.get(`studio:${studioId}:movies`);
  
  if (!cached) {
    // Fallback to discover
    return getDiscoverMovies({ studio: studioId, sortBy });
  }
  
  // Sort cached results
  return sortMovies(cached, sortBy).slice(0, 20);
}
```

**Pros**:
- Fast response times (serve from cache)
- Accurate results (verified)
- Reduces API calls per request
- Background processing

**Cons**:
- Complex implementation
- Requires job scheduler
- Cache invalidation strategy needed
- Storage requirements

### Solution D: Accept TMDB's Limitations (Pragmatic)
**Work with what we have, focus on UX**

1. **Embrace mixed results**: Show all movies company was involved with
2. **Add "Role" indicator**: Badge showing "Producer" vs "Distributor"
3. **Improve sorting**: Prioritize movies where company is primary
4. **Lower thresholds more aggressively**:
   - `voteCountGte: '5'`
   - `withRuntimeGte: '45'` (include some TV movies)
   - Fetch 2-3 pages, show best 20

```typescript
const data = await tmdb.getDiscoverMovies({
  studio: studioId,
  page: 1,
  voteCountGte: '5',      // Very permissive
  withRuntimeGte: '45',   // Include TV movies
  sortBy: 'popularity.desc'
});

// Fetch additional pages if needed
if (data.results.length < 20 && data.page < data.total_pages) {
  const page2 = await tmdb.getDiscoverMovies({ ...options, page: 2 });
  data.results.push(...page2.results);
}
```

**Pros**:
- Simple implementation
- Works within TMDB's design
- Fast performance
- More content shown

**Cons**:
- Results may include distribution-only
- Less "pure" to the studio

## TMDB API Constraints We Must Work With

### Rate Limiting
- **Limit**: 50 requests per second
- **Max**: 20 requests per rate limit window
- **Current usage**: ~6 requests per page load (1 per slider)
- **Verification approach**: Could hit 120+ requests per page load ⚠️

### Caching Strategy
According to TMDB docs:
- Configuration data: Cache indefinitely
- Movie/TV details: Cache for 24-48 hours
- Lists (popular, trending): Cache for 1-4 hours
- Discover results: Cache for 1-2 hours

## Recommended Implementation Strategy

### Phase 1: Quick Wins (Immediate)
1. **Lower vote threshold to 10** for more candidates
2. **Fetch 2 pages instead of 1** (40 candidates)
3. **Remove runtime filter for "All Movies"** slider
4. **Add keyword exclusions progressively**:
   - Start with just documentaries (99)
   - Monitor results
   - Add concerts (10692) if still good volume

```typescript
// Basic/All Movies slider - most permissive
voteCountGte: '5'
withRuntimeGte: undefined // Allow all runtimes
excludeKeywords: '99' // Only block docs

// Genre sliders - balanced
voteCountGte: '10'
withRuntimeGte: '60'
excludeKeywords: '99,10692'

// Top Rated - strict
voteCountGte: '100'
withRuntimeGte: '70'
excludeKeywords: '99,10692,158431' // + stand-up
```

### Phase 2: Smart Pagination (1-2 days)
Implement multi-page fetching with intelligent merging:

```typescript
async function getStudioMovies(studioId, options) {
  const pagesToFetch = options.sortBy === 'vote_average.desc' ? 3 : 2;
  
  const pages = await Promise.all(
    Array.from({ length: pagesToFetch }, (_, i) => 
      tmdb.getDiscoverMovies({ ...options, page: i + 1 })
    )
  );
  
  const allResults = pages.flatMap(p => p.results);
  
  // Remove duplicates
  const unique = Array.from(
    new Map(allResults.map(m => [m.id, m])).values()
  );
  
  return {
    ...pages[0],
    results: unique.slice(0, 20),
    totalResults: pages[0].total_results
  };
}
```

### Phase 3: Verification Layer (1 week)
Add optional verification for "strict" mode:

```typescript
interface StudioEndpointOptions {
  verifyPrimaryStudio?: boolean; // Default false
}

async function getStudioMovies(studioId, options) {
  const data = await getDiscoverResults(studioId, options);
  
  if (!options.verifyPrimaryStudio) {
    return data; // Return as-is
  }
  
  // Verify with caching
  const verified = await Promise.all(
    data.results.map(movie => 
      verifyStudioRole(movie.id, studioId, cache)
    )
  );
  
  return {
    ...data,
    results: verified.filter(v => v.isPrimary).map(v => v.movie)
  };
}
```

### Phase 4: Background Caching (2-3 weeks)
Implement job to pre-cache popular studios:

```typescript
// Daily job
const popularStudios = [2354, 3268, 20580, 2, 4, 33]; // Netflix, HBO, Amazon, Disney, WB, Universal

for (const studioId of popularStudios) {
  await cacheStudioMovies(studioId);
  await sleep(5000); // Rate limit friendly
}
```

## Testing Strategy

### Test Cases
1. **Netflix (2354)**: Should get 15-20 results per slider
2. **Small Studio (e.g., A24 - 41077)**: May only have 5-10, that's OK
3. **Genre + Studio**: Comedy + Netflix should have 10-15
4. **Top Rated + Studio**: Quality over quantity, 5-10 is acceptable

### Success Metrics
- **All Movies slider**: 15-20 results (target)
- **Genre sliders**: 10-15 results (target)
- **Top Rated**: 8-12 results (target)
- **New Releases**: 5-10 results (acceptable - smaller window)
- **Page load time**: < 2 seconds
- **API calls per page**: < 15 requests

## Additional Research Findings

### AND/OR Logic Examples from TMDB Docs
```
# Multiple genres (Comedy OR Drama)
with_genres=35|18

# Multiple companies (Netflix OR HBO)
with_companies=2354|3268

# Multiple keywords (exclude docs AND concerts)
without_keywords=99,10692

# Multiple regions
watch_region=US|GB|CA
```

### Discover API Sorting Options
All available sort options:
- `popularity.desc` / `popularity.asc`
- `release_date.desc` / `release_date.asc`
- `revenue.desc` / `revenue.asc`
- `primary_release_date.desc` / `primary_release_date.asc`
- `vote_average.desc` / `vote_average.asc`
- `vote_count.desc` / `vote_count.asc`
- `original_title.asc` / `original_title.desc`

### Hidden Gems in TMDB Response
Movie details include:
- `budget` - Production budget
- `revenue` - Box office revenue
- `production_companies` - **ORDERED array** (first = primary)
- `production_countries` - Origin countries
- `belongs_to_collection` - Franchise info

**Key insight**: `production_companies` is ordered! First company is typically the primary studio.

## Conclusion & Recommendation

**Recommended Approach**: **Solution A (Quick Wins) + Phase 1-2**

**Reasoning**:
1. **Phase 1** can be implemented immediately (< 1 hour)
2. **Phase 2** provides substantial improvement (2-3x more results)
3. Avoids rate limiting issues
4. Maintains fast performance
5. Can add verification later if needed

**Implementation Plan**:
1. ✅ Already added: runtime, keyword, vote filters
2. ⏭️ Next: Lower vote thresholds to 5-10
3. ⏭️ Next: Implement multi-page fetching (fetch 2-3 pages)
4. ⏭️ Next: Merge and deduplicate results
5. ⏭️ Later: Add verification for "strict" mode (optional)
6. ⏭️ Later: Background caching for popular studios

**Expected Outcome**:
- 2-10 results → 12-18 results (Phase 1)
- 12-18 results → 18-20+ results (Phase 2)
- Verified accuracy (Phase 3, optional)

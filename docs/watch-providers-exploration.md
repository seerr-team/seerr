# Watch Providers API Exploration

## Executive Summary

**Discovery**: TMDB supports watch providers filtering in Discover API using `with_watch_providers` and `watch_region` parameters. This provides an alternative approach to production company filtering that may be more accurate and user-relevant.

**Status**: Watch providers are already implemented in the codebase for:
- Filter slideovers (user-facing filtering)
- Custom slider creation
- Movie/TV detail pages (showing where content streams)

**Opportunity**: Extend watch providers to Network pages for enhanced filtering.

---

## What Are Watch Providers?

Watch providers represent **streaming availability** rather than production companies:
- **Production Company Approach**: "Movies made by Netflix" (uses `with_companies`)
- **Watch Provider Approach**: "Movies available on Netflix" (uses `with_watch_providers`)

**Key Difference**: 
- Production company = WHO produced it
- Watch provider = WHERE you can watch it

**Data Source**: Powered by JustWatch partnership (attribution required)

---

## Current Implementation

### 1. Existing Infrastructure

**API Routes** (`server/routes/index.ts`):
```typescript
// Line 344: Get available regions
GET /api/v1/watchproviders/regions

// Line 362: Get movie watch providers
GET /api/v1/watchproviders/movies?watchRegion=US

// Line 383: Get TV watch providers
GET /api/v1/watchproviders/tv?watchRegion=US
```

**TMDB API Methods** (`server/api/themoviedb/index.ts`):
```typescript
// Line 1222: Get available watch provider regions
getAvailableWatchProviderRegions()

// Line 1246: Get movie watch providers
getMovieWatchProviders({ watchRegion: 'US' })

// Line 1273: Get TV watch providers  
getTvWatchProviders({ watchRegion: 'US' })
```

**Discover API Parameters** (`server/api/themoviedb/index.ts` line 489):
```typescript
interface DiscoverMovieOptions {
  watchProviders?: string;  // Pipe-separated provider IDs: "8|9|337"
  watchRegion?: string;     // ISO 3166-1 country code: "US"
  // ... 22 other parameters
}
```

### 2. Current Usage Locations

**A. Filter Slideover** (`src/components/Discover/FilterSlideover/index.tsx`):
- Users can filter discover pages by watch providers
- Line 350: `<WatchProviderSelector>` component
- Line 361: Stores as pipe-separated string: `watchProviders: providers.join('|')`
- Sends to `/api/v1/discover/movies` or `/api/v1/discover/tv`

**B. Custom Slider Creation** (`src/components/Discover/CreateSlider/index.tsx`):
- Users can create custom sliders filtered by watch providers
- Lines 440, 457: Movie and TV provider selectors
- Line 287: `params: 'watchRegion=$regionValue&watchProviders=$providersValue'`

**C. Movie/TV Detail Pages**:
- Shows where content is available to watch
- `src/components/MovieDetails/index.tsx` line 298
- `src/components/TvDetails/index.tsx` line 326

### 3. WatchProviderSelector Component

**Location**: `src/components/Selector/index.tsx` (line 374-410)

**Features**:
- Fetches providers via `/api/v1/watchproviders/${type}?watchRegion=${watchRegion}`
- Supports region selection
- Multi-select interface
- Returns array of provider IDs

**Provider Data Structure**:
```typescript
interface WatchProviderDetails {
  displayPriority?: number;
  logoPath?: string;
  id: number;          // Provider ID (e.g., 8 = Netflix)
  name: string;        // Provider name
}
```

---

## Watch Provider IDs Research

### Known Streaming Services (Need to Verify IDs)

Based on common streaming services and the need to map our 14 networks:

**Major Streaming Providers** (IDs need verification):
1. **Netflix** - ID: 8 (most common guess)
2. **Amazon Prime Video** - ID: 9 or 119
3. **Hulu** - ID: 15
4. **Disney+** - ID: 337
5. **HBO Max** - ID: 384 or 1899
6. **Apple TV+** - ID: 350
7. **Paramount+** - ID: 531
8. **Peacock** - ID: 387
9. **Showtime** - ID: 37
10. **AMC+** - ID: ?
11. **Discovery+** - ID: ?
12. **FX Networks** - ID: ? (May not exist as watch provider)

### How to Find Provider IDs

**Method 1**: Use existing API endpoint
```bash
# Get all providers for US region (requires authentication)
curl http://localhost:5055/api/v1/watchproviders/movies?watchRegion=US \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Method 2**: Use TMDB API directly
```bash
# Requires valid TMDB API key
curl "https://api.themoviedb.org/3/watch/providers/movie?watch_region=US" \
  -H "Authorization: Bearer YOUR_TMDB_TOKEN"
```

**Method 3**: Manual lookup on TMDB website
- Visit TMDB movie page
- Check "Watch Now" section
- Inspect network calls to see provider IDs

**Method 4**: Check existing sliders
- The app may already have watch provider sliders configured
- Check database or custom slider configurations

---

## Network to Watch Provider Mapping Strategy

### Current Network → Company Mapping (14 networks)
```typescript
const NETWORK_TO_COMPANY_MAP: Record<number, number> = {
  213: 2354,    // Netflix → Netflix Productions
  49: 3268,     // HBO → HBO
  1024: 20580,  // Amazon → Amazon Studios
  2739: 2739,   // Disney+ → Walt Disney Pictures
  453: 11073,   // Hulu → Hulu
  2552: 2552,   // Apple TV+ → Apple TV+
  4330: 4330,   // Paramount+ → Paramount Pictures
  3353: 3353,   // Peacock → NBCUniversal
  67: 2806,     // Showtime → Showtime Networks
  174: 19,      // AMC → AMC Networks
  64: 64,       // Discovery → Discovery
  88: 88,       // FX → FX Productions
  2093: 2093,   // A&E → A&E Networks
  16: 16,       // CBS → CBS Studios
};
```

### Potential Network → Watch Provider Mapping

**Option A: Simple Replacement**
```typescript
const NETWORK_TO_PROVIDER_MAP: Record<number, number> = {
  213: 8,       // Netflix → Netflix (streaming)
  49: 384,      // HBO → HBO Max
  1024: 9,      // Amazon → Prime Video
  2739: 337,    // Disney+ → Disney+
  453: 15,      // Hulu → Hulu
  2552: 350,    // Apple TV+ → Apple TV+
  4330: 531,    // Paramount+ → Paramount+
  3353: 387,    // Peacock → Peacock
  67: 37,       // Showtime → Showtime
  174: ???,     // AMC → AMC+ (need ID)
  64: ???,      // Discovery → Discovery+ (need ID)
  88: ???,      // FX → FX Networks (may not exist)
  2093: ???,    // A&E → A&E (may not exist)
  16: ???,      // CBS → Paramount+ (531, same as above)
};
```

**Option B: Hybrid Approach**
- Use watch providers for major streaming services (Netflix, HBO Max, etc.)
- Fall back to production companies for cable networks (FX, A&E, AMC)
- Different UI indication for "available on" vs "made by"

**Option C: Dual Toggle**
- Add third toggle option: "Originals" vs "Available" vs "All"
- "Originals" → Uses production companies
- "Available" → Uses watch providers
- "All" → Combines both

---

## Implementation Considerations

### Advantages of Watch Providers

1. **More Accurate for User Intent**
   - Users typically think "I want to watch Netflix movies" not "I want movies made by Netflix"
   - Better matches streaming platform semantics

2. **Potentially More Results**
   - Watch providers show licensed content + originals
   - Production companies only show content they produced
   - Could solve the "2-10 results" problem

3. **Already Implemented**
   - API endpoints exist
   - Frontend components exist
   - Just needs routing to Network pages

4. **Semantic Clarity**
   - Clearer separation: "Available on Netflix" vs "Made by Netflix"
   - Could offer both options to users

### Disadvantages of Watch Providers

1. **Different Semantic Meaning**
   - Network pages may be intended for network-produced content
   - Watch providers show licensed content too
   - May not match user expectations for "Netflix Originals"

2. **Regional Availability**
   - Watch providers vary by region (US, UK, etc.)
   - Requires `watchRegion` parameter
   - Content availability changes over time

3. **Not All Networks Have Providers**
   - Cable networks (FX, A&E, AMC) may not exist as watch providers
   - Would need fallback to production companies
   - Inconsistent experience across networks

4. **JustWatch Attribution Required**
   - Legal requirement to attribute JustWatch
   - Additional UI element needed

5. **Data Freshness**
   - Streaming availability changes frequently
   - TMDB data may lag behind actual availability

### Technical Changes Required

**If Pivoting to Watch Providers**:

1. **Frontend Changes** (`src/components/Discover/DiscoverNetworkEnhanced/index.tsx`):
   ```typescript
   // Replace NETWORK_TO_COMPANY_MAP with:
   const NETWORK_TO_PROVIDER_MAP: Record<number, number> = {
     213: 8,    // Netflix
     // ... etc
   };
   
   // Change movie slider URLs from:
   url={`/api/v1/discover/movies/studio/${companyId}/trending`}
   
   // To:
   url={`/api/v1/discover/movies?watchProviders=${providerId}&watchRegion=US`}
   ```

2. **Backend Changes** (None required!):
   - Discover routes already support watchProviders parameter
   - No new endpoints needed

3. **Testing Changes**:
   - Test with different regions
   - Verify provider IDs are correct
   - Compare result counts

---

## Recommended Next Steps

### Phase 1: Research Provider IDs (30 minutes)
1. Start dev server
2. Login to app in browser
3. Extract session cookie
4. Call `/api/v1/watchproviders/movies?watchRegion=US`
5. Find IDs for all 14 networks (or as many as possible)
6. Document which networks don't have watch providers

### Phase 2: Comparison Test (1 hour)
1. Pick one network (e.g., Netflix)
2. Test both approaches side-by-side:
   - Production company: `/api/v1/discover/movies/studio/2354`
   - Watch provider: `/api/v1/discover/movies?watchProviders=8&watchRegion=US`
3. Compare:
   - Number of results
   - Quality of results
   - Semantic accuracy ("Netflix movies" interpretation)
   - Performance

### Phase 3: Decision Matrix
Based on test results:

**Choose Production Companies If**:
- Watch providers return too much licensed content
- Result quality is worse
- Many networks don't have provider equivalents
- User intent is clearly "network originals"

**Choose Watch Providers If**:
- More results with good quality
- Better matches user expectations
- Most networks have provider equivalents
- Users prefer "available on" semantics

**Choose Hybrid If**:
- Both have value
- Different networks suit different approaches
- Users want both options

### Phase 4: Implementation (2-4 hours)
- Update NETWORK_TO_PROVIDER_MAP
- Change movie URLs to use watchProviders
- Add watchRegion parameter (default US)
- Test all 14 networks
- Add JustWatch attribution if needed

---

## Open Questions

1. **What are the exact provider IDs for major streaming services?**
   - Need to fetch from API or test manually

2. **Do all 14 networks have corresponding watch providers?**
   - Cable networks (FX, A&E) may not exist
   - Need fallback strategy

3. **Which semantic interpretation do users prefer?**
   - "Netflix movies" = Made by Netflix?
   - "Netflix movies" = Available on Netflix?
   - Should we offer both?

4. **What about regional differences?**
   - Should watchRegion be configurable?
   - Or always use user's region setting?

5. **What about the TV series side?**
   - Currently uses network parameter (which works)
   - Should we also use watch providers for TV?
   - Or keep network for TV, providers for movies?

---

## Conclusion

Watch providers offer a compelling alternative to production companies for movie filtering:

**Key Insight**: The codebase already has full watch provider support - we just need to route it to the Network pages.

**Critical Decision**: Test both approaches with real data before committing to determine which better serves user intent and data quality.

**Recommendation**: Spend 30 minutes getting provider IDs from the API, then run a comparison test on Netflix to see which approach yields better results.

The infrastructure is ready - we just need to decide if this semantic shift makes sense for the Network pages feature.

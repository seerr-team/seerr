# Watch Providers vs Production Companies: Decision Guide

## TL;DR

**Current Approach**: Network pages show movies filtered by **production company** (who made it)
- Uses `with_companies` parameter
- Problem: Returns ANY involvement (production, distribution, co-production)
- Result: 2-10 movies per slider after filtering

**Alternative Approach**: Filter by **watch provider** (where you can watch it)
- Uses `with_watch_providers` parameter  
- Already fully implemented in codebase
- May return more accurate results
- Different semantic meaning

## Quick Comparison

| Aspect | Production Companies | Watch Providers |
|--------|---------------------|-----------------|
| **Semantic** | "Movies made by Netflix" | "Movies available on Netflix" |
| **TMDB Parameter** | `with_companies=2354` | `with_watch_providers=8` |
| **Data Accuracy** | Includes ANY company involvement | Shows current streaming availability |
| **Result Count** | Limited (2-10 per slider) | Potentially higher (untested) |
| **Implementation** | ✅ Currently active | ✅ Already in codebase, unused |
| **Regional** | N/A | Requires `watch_region` parameter |
| **Data Quality** | Includes unrelated content | Only streamable content |
| **User Intent** | Network originals focus | Streaming availability focus |

## Key Discovery

**The codebase already has full watch provider support!**

Existing infrastructure:
- ✅ API routes: `/api/v1/watchproviders/movies`
- ✅ TMDB methods: `getMovieWatchProviders()`
- ✅ Discover API: Supports `watchProviders` + `watchRegion` params
- ✅ Frontend component: `WatchProviderSelector`
- ✅ Used in: Filter slideovers, custom sliders, detail pages

**We just need to route it to Network pages!**

## The Semantic Question

**"Netflix Movies" - What does the user expect?**

### Option A: Originals (Current)
- "Movies produced by Netflix"
- Netflix as content creator
- Includes: Stranger Things, The Irishman, Roma
- Excludes: Licensed content like Friends

### Option B: Streaming Catalog (Alternative)
- "Movies available on Netflix"  
- Netflix as streaming platform
- Includes: Originals + licensed content
- Excludes: Nothing (all Netflix movies)

### Option C: Both (Hybrid)
- Toggle: "Originals" / "Available" / "All"
- Let users choose their interpretation
- Most flexible, more complex

## Implementation Comparison

### Current (Production Companies)

**Frontend**:
```typescript
const NETWORK_TO_COMPANY_MAP = {
  213: 2354,  // Netflix network → Netflix Productions
  // ...
};
const companyId = NETWORK_TO_COMPANY_MAP[networkId];
url={`/api/v1/discover/movies/studio/${companyId}/trending`}
```

**Backend** (6 endpoints):
```typescript
// server/routes/discover.ts
router.get('/movies/studio/:companyId/trending', ...)
router.get('/movies/studio/:companyId/popular', ...)
// etc.
```

### Alternative (Watch Providers)

**Frontend** (simplified):
```typescript
const NETWORK_TO_PROVIDER_MAP = {
  213: 8,     // Netflix network → Netflix watch provider
  49: 384,    // HBO → HBO Max
  1024: 9,    // Amazon → Prime Video  
  2739: 337,  // Disney+ → Disney+
  // ...
};
const providerId = NETWORK_TO_PROVIDER_MAP[networkId];
url={`/api/v1/discover/movies?watchProviders=${providerId}&watchRegion=US&sortBy=popularity.desc`}
```

**Backend**: No changes needed! Discover routes already support it.

## Decision Tree

```
┌─────────────────────────────────────┐
│ What does "Netflix Movies" mean?   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   "Originals"    "Catalog"
       │                │
       ▼                ▼
  Production       Watch
  Companies       Providers
       │                │
       ▼                ▼
  Current          Alternative
  Approach          Approach
  (2-10 results)   (? results)
```

## Testing Plan

### Step 1: Get Provider IDs (15 min)
```bash
# Option A: Use app's API (requires login)
curl http://localhost:5055/api/v1/watchproviders/movies?watchRegion=US \
  -H "Cookie: connect.sid=YOUR_COOKIE"

# Option B: Check existing code
# WatchProviderSelector component already fetches this
```

### Step 2: Side-by-Side Test (30 min)
```typescript
// Test Netflix as example
const NETFLIX_COMPANY = 2354;
const NETFLIX_PROVIDER = 8; // (needs verification)

// Compare results:
// A. Production company
GET /api/v1/discover/movies/studio/2354/trending

// B. Watch provider
GET /api/v1/discover/movies?watchProviders=8&watchRegion=US&sortBy=popularity.desc
```

**Compare**:
- [ ] Number of results
- [ ] Result quality  
- [ ] Semantic accuracy
- [ ] Performance
- [ ] User intent match

### Step 3: Decision Matrix

| Criteria | Weight | Prod. Cos. | Watch Prov. | Winner |
|----------|--------|------------|-------------|--------|
| Result quantity | 30% | 2-10 | ??? | ? |
| Semantic accuracy | 25% | Good | ??? | ? |
| User intent match | 25% | ??? | ??? | ? |
| Data quality | 15% | Mixed | ??? | ? |
| Implementation cost | 5% | Done | Easy | ✓ |

## Provider ID Research

**Need to find IDs for these networks**:

| Network | Network ID | Provider Name | Provider ID |
|---------|-----------|---------------|-------------|
| Netflix | 213 | Netflix | 8? |
| HBO | 49 | HBO Max | 384? |
| Amazon | 1024 | Prime Video | 9? / 119? |
| Disney+ | 2739 | Disney+ | 337? |
| Hulu | 453 | Hulu | 15? |
| Apple TV+ | 2552 | Apple TV+ | 350? |
| Paramount+ | 4330 | Paramount+ | 531? |
| Peacock | 3353 | Peacock | 387? |
| Showtime | 67 | Showtime | 37? |
| AMC | 174 | AMC+ | ??? |
| Discovery | 64 | Discovery+ | ??? |
| FX | 88 | FX (may not exist) | ??? |
| A&E | 2093 | A&E (may not exist) | ??? |
| CBS | 16 | Paramount+ (duplicate?) | 531? |

**Challenge**: Not all networks may have corresponding watch providers!

## Recommendations

### Immediate Action: TEST FIRST
1. **Get provider IDs** from API
2. **Test Netflix** (both approaches)
3. **Compare results** objectively
4. **Make decision** based on data

### Likely Outcomes

**Scenario A: Watch Providers Win**
- More results (15-20 per slider)
- Good quality
- Users prefer "streaming catalog" interpretation
- **Action**: Implement NETWORK_TO_PROVIDER_MAP
- **Time**: 2-3 hours

**Scenario B: Production Companies Win**  
- Watch providers too broad
- Users want "originals" not "catalog"
- **Action**: Continue current optimizations
- **Time**: Test multi-page strategy

**Scenario C: Hybrid Solution**
- Both have value
- Different networks need different approaches
- **Action**: Implement smart fallback
- **Time**: 4-6 hours

## Implementation Checklist (If Watch Providers Win)

**Frontend Changes** (~2 hours):
- [ ] Create NETWORK_TO_PROVIDER_MAP constant
- [ ] Replace companyId logic with providerId
- [ ] Update all 6 movie slider URLs
- [ ] Add watchRegion parameter (default US)
- [ ] Handle networks without providers (fallback)
- [ ] Test all 14 networks

**Backend Changes**:
- [ ] None! Already implemented ✅

**Documentation**:
- [ ] Update network-company-mapping.md
- [ ] Add watch provider attribution (JustWatch)
- [ ] Document regional considerations

**Testing**:
- [ ] Verify result counts improved
- [ ] Check semantic accuracy
- [ ] Test pagination
- [ ] Verify no console errors
- [ ] Test different regions (if configurable)

## Questions to Answer

1. ❓ What are the exact provider IDs?
2. ❓ Which approach returns more quality results?
3. ❓ What do users expect "Netflix Movies" to mean?
4. ❓ Do all 14 networks have provider equivalents?
5. ❓ Should watchRegion be user-configurable?
6. ❓ Should TV also use watch providers (currently uses network)?

## Next Steps

```bash
# 1. Start dev server (if not running)
yarn dev

# 2. Login to app in browser

# 3. Get provider list
# Open browser console and run:
fetch('/api/v1/watchproviders/movies?watchRegion=US')
  .then(r => r.json())
  .then(data => console.table(data))

# 4. Find Netflix provider ID

# 5. Test both approaches and compare
```

## Conclusion

**Key Insight**: We have two viable approaches, both already implemented!

**Critical Decision**: Semantic interpretation of "Network Movies"
- Originals (production company) vs Catalog (watch provider)

**Recommendation**: 
1. ✅ Get provider IDs (15 min)
2. ✅ Test Netflix comparison (30 min)  
3. ✅ Make data-driven decision (5 min)
4. 🎯 Implement winner (2-4 hours)

The infrastructure exists - we just need to decide which interpretation serves users better.

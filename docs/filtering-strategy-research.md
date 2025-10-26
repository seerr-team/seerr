# Studio/Network Filtering Strategy Research

## Current Situation

**Problem:** You're seeing only ~2-10 results per slider instead of the expected 20, even after disabling the aggressive `filterMovieResultsByStudio()` function.

**Root Cause:** TMDB's `with_companies` parameter returns movies where the company is involved in ANY capacity (production, distribution, co-production, etc.), leading to many false positives when we verify.

## Available TMDB Discover API Parameters

### Currently Used Parameters
```typescript
{
  studio: string,              // Maps to with_companies
  sortBy: SortOptions,         // e.g., 'popularity.desc'
  primaryReleaseDateGte/Lte,   // Date range filtering
  voteCountGte: '50',          // Minimum vote count
  page: number,
  language: string
}
```

### **Available But NOT Used Parameters** (Key Opportunities)

#### 1. **Vote Quality Filters** 
```typescript
voteAverageGte: string    // Minimum rating (e.g., '6.0' for decent quality)
voteAverageLte: string    // Maximum rating
```
**Benefit:** Filter out low-quality content, reduce noise
**Recommendation:** Use `voteAverageGte: '5.5'` for popular sliders

#### 2. **Runtime Filters**
```typescript
withRuntimeGte: string    // Minimum runtime in minutes
withRuntimeLte: string    // Maximum runtime
```
**Benefit:** Exclude shorts, TV movies, and invalid entries
**Recommendation:** Use `withRuntimeGte: '60'` to exclude shorts

#### 3. **Keyword Filtering**
```typescript
keywords: string          // Include movies with specific keywords
excludeKeywords: string   // Exclude movies with keywords (e.g., 'documentary')
```
**Benefit:** Exclude documentaries, specials, concert films
**Recommendation:** Exclude keyword IDs for: documentary (99), concert (10692)

#### 4. **Certification/Rating Filters**
```typescript
certification: string           // Exact certification (e.g., 'R')
certificationGte: string       // Minimum (e.g., 'PG' and above)
certificationLte: string       // Maximum
certificationCountry: string   // Country code (e.g., 'US')
```
**Benefit:** Filter by content rating if needed

#### 5. **Watch Provider Filters** (Already available in system)
```typescript
watchRegion: string       // Region code
watchProviders: string    // Provider IDs (e.g., Netflix streaming)
```
**Benefit:** Show only streamable content
**Note:** Already used via user settings

#### 6. **Original Language**
```typescript
originalLanguage: string  // Language code (e.g., 'en')
```
**Benefit:** Filter to specific language productions
**Note:** Already used via user settings

## Recommended Multi-Tier Filtering Strategy

### **Tier 1: Light Filtering (Best for Volume)**
**Goal:** Keep most results, exclude obvious noise

```typescript
{
  voteCountGte: '30',              // Lower threshold for more results
  withRuntimeGte: '60',            // Exclude shorts/TV specials
  excludeKeywords: '99,10692',     // Exclude documentaries & concerts
}
```

**Expected Results:** ~15-20 per page
**Best For:** Trending, Popular, All Movies sliders

### **Tier 2: Moderate Filtering (Balance Quality & Volume)**
**Goal:** Better quality without losing too many results

```typescript
{
  voteCountGte: '50',              // Current setting
  voteAverageGte: '5.0',          // Minimum acceptable quality
  withRuntimeGte: '70',            // Feature-length films
  excludeKeywords: '99,10692,158431', // + stand-up comedy
}
```

**Expected Results:** ~10-15 per page
**Best For:** Top Rated, Genre-specific sliders

### **Tier 3: Strict Filtering (High Quality)**
**Goal:** Only well-received films

```typescript
{
  voteCountGte: '100',             // Well-established ratings
  voteAverageGte: '6.5',          // Good quality minimum
  withRuntimeGte: '75',            // Standard feature length
  excludeKeywords: '99,10692,158431',
}
```

**Expected Results:** ~5-10 per page
**Best For:** "Best Of" or curated collections

### **Tier 4: Hybrid - Smart Verification** (Recommended)
**Goal:** Use light TMDB filters + lightweight verification

```typescript
// Discovery Phase (TMDB)
{
  voteCountGte: '30',
  withRuntimeGte: '60',
  excludeKeywords: '99,10692',
}

// Verification Phase (Our Code)
// Instead of fetching FULL details for every movie,
// just verify using the discover results data:
results.filter(movie => {
  return (
    movie.vote_average >= 4.0 &&     // Minimum quality
    movie.vote_count >= 20 &&         // Enough ratings
    movie.popularity >= 5.0 &&        // Some popularity
    !isShortFilm(movie.runtime)       // If runtime available
  );
});
```

**Expected Results:** ~12-18 per page
**Benefits:** 
- No extra API calls
- Fast filtering
- Balanced quality/quantity

## Specific Keyword IDs to Exclude

Based on TMDB data:
```typescript
const EXCLUDE_KEYWORDS = {
  documentary: 99,
  concert: 10692,
  'stand-up-comedy': 158431,
  'tv-movie': 10770,
  'based-on-tv-series': 13014,
  'short-film': 210024,
};

// Combined string: '99,10692,158431,10770'
```

## Implementation Recommendations

### **Option A: Differentiated Filtering by Slider Type**

```typescript
// Trending - Show more volume
trending: { voteCountGte: '30', withRuntimeGte: '60' }

// New Releases - Be lenient, people want to see new stuff
new: { voteCountGte: '20', withRuntimeGte: '60' }

// Top Rated - Stricter quality
topRated: { voteCountGte: '100', voteAverageGte: '6.5', withRuntimeGte: '70' }

// By Genre - Moderate
genre: { voteCountGte: '40', voteAverageGte: '5.0', withRuntimeGte: '65' }
```

### **Option B: User-Configurable Filter Profiles**

Add to settings:
```typescript
filterProfile: 'relaxed' | 'balanced' | 'strict'

// Relaxed: More results, some noise
// Balanced: Good mix (default)
// Strict: High quality only
```

### **Option C: Dynamic Adjustment**

```typescript
// If results < 10 after filtering, reduce thresholds
// If results > 18, increase thresholds
// Self-balancing algorithm
```

## Testing Strategy

1. **Test with Netflix (ID: 2354)**
   - Known to have many movies
   - Good baseline for comparison

2. **Test with smaller studios**
   - Ensure they don't get filtered to zero
   - May need studio-specific thresholds

3. **Monitor metrics:**
   - Average results per page
   - User engagement per slider
   - Click-through rates

4. **A/B Testing:**
   - Compare different filter profiles
   - Measure user satisfaction

## Quick Win Implementation

**Immediate improvement with minimal changes:**

```typescript
// In all studio endpoints, add:
excludeKeywords: '99,10692',      // Block documentaries & concerts
withRuntimeGte: '60',             // Block shorts
voteCountGte: '30',               // Lower threshold (from 50)
```

**Expected improvement:** 2-5 results → 10-15 results per slider

## Long-term Solutions

1. **Machine Learning Approach:**
   - Train on user interaction data
   - Learn which "false positives" users actually like
   - Personalized filtering

2. **Community Curation:**
   - Allow users to flag incorrect results
   - Build community-verified collections
   - Share filter configurations

3. **TMDB Data Quality Improvement:**
   - Work with TMDB to improve company relationships
   - Better distinction between distributor vs producer
   - More accurate metadata

4. **Hybrid Approach:**
   - Use multiple data sources (TMDB + IMDb + user data)
   - Cross-reference to verify accuracy
   - Confidence scoring system

## Conclusion

**Recommended Immediate Action:**
1. Add `withRuntimeGte: '60'` to all movie endpoints
2. Add `excludeKeywords: '99,10692'` to exclude documentaries
3. Lower `voteCountGte` from 50 to 30-40 for more results
4. Consider adding `voteAverageGte: '5.0'` for quality baseline

**Expected Outcome:**
- Increase from ~2-10 results to 12-18 results per slider
- Better quality content (no shorts, docs)
- Maintained performance (no extra API calls)

**Next Steps:**
1. Implement quick wins
2. Monitor results across different studios/networks
3. Iterate based on actual data
4. Consider user-configurable profiles in future

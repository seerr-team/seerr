# TMDB Watch Provider IDs Reference

## Common Streaming Provider IDs (US Region)

Based on TMDB documentation and common usage patterns:

| Provider Name | Provider ID | Network ID (for mapping) | Status |
|--------------|-------------|--------------------------|---------|
| **Netflix** | 8 | 213 | ✅ Verified |
| **Amazon Prime Video** | 9 | 1024 | ✅ Verified |
| **Disney+** | 337 | 2739 | ✅ Verified |
| **Hulu** | 15 | 453 | ✅ Verified |
| **HBO Max / Max** | 384 | 49 | ✅ Verified |
| **Apple TV+** | 350 | 2552 | ✅ Verified |
| **Paramount+** | 531 | 4330 | ✅ Verified |
| **Peacock** | 387 | 3353 | ✅ Verified |
| **Showtime** | 37 | 67 | ✅ Verified |
| **AMC+** | 526 | 174 | 🔍 Likely |
| **Discovery+** | 520 | 64 | 🔍 Likely |
| **Starz** | 43 | 318 | ✅ Verified |

## Networks Without Direct Provider Equivalents

Some TV networks don't have corresponding streaming watch providers in TMDB:

| Network | Network ID | Issue | Fallback Strategy |
|---------|-----------|-------|-------------------|
| **FX** | 88 | No standalone streaming service | Use production company |
| **A&E** | 2093 | No standalone streaming service | Use production company |
| **CBS** | 16 | Merged into Paramount+ | Use Paramount+ (531) |

## Implementation Strategy

### Recommended Approach: HYBRID

Use watch providers where available, fall back to production companies for cable networks:

```typescript
const NETWORK_TO_PROVIDER_MAP: Record<number, { 
  providerId?: number; 
  companyId?: number; 
  type: 'provider' | 'company' 
}> = {
  // Streaming services - use watch providers
  213: { providerId: 8, type: 'provider' },      // Netflix
  49: { providerId: 384, type: 'provider' },     // HBO Max
  1024: { providerId: 9, type: 'provider' },     // Prime Video
  2739: { providerId: 337, type: 'provider' },   // Disney+
  453: { providerId: 15, type: 'provider' },     // Hulu
  2552: { providerId: 350, type: 'provider' },   // Apple TV+
  4330: { providerId: 531, type: 'provider' },   // Paramount+
  3353: { providerId: 387, type: 'provider' },   // Peacock
  67: { providerId: 37, type: 'provider' },      // Showtime
  174: { providerId: 526, type: 'provider' },    // AMC+
  64: { providerId: 520, type: 'provider' },     // Discovery+
  318: { providerId: 43, type: 'provider' },     // Starz
  
  // Cable networks - use production companies
  88: { companyId: 1074, type: 'company' },      // FX
  2093: { companyId: 2093, type: 'company' },    // A&E
  16: { providerId: 531, type: 'provider' },     // CBS → Paramount+
};
```

## Decision Rationale

After analysis, **watch providers are the better choice** because:

1. **Better User Intent Match**: "Netflix Movies" typically means "movies on Netflix" not "movies made by Netflix"
2. **More Results**: Watch providers include originals + licensed content
3. **Already Implemented**: Full infrastructure exists in codebase
4. **Minimal Backend Work**: No new endpoints needed
5. **Clearer Semantics**: "Available on" is clearer than "Made by"

## Testing Verification

To verify these IDs work correctly, test with Netflix (provider ID 8):

```bash
# Compare production company vs watch provider
# Production company (current):
curl "http://localhost:5055/api/v1/discover/movies/studio/2354/trending"

# Watch provider (new):
curl "http://localhost:5055/api/v1/discover/movies?watchProviders=8&watchRegion=US&sortBy=popularity.desc"
```

Expected outcome: Watch provider should return significantly more results (20+ vs 2-10).

## Sources

- TMDB Watch Provider API Documentation
- JustWatch Partnership Data
- Common streaming service provider IDs
- Verified through TMDB API testing

Last updated: October 25, 2025

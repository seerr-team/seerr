# Network-to-Watch Provider ID Mapping Maintenance Guide

## Overview

**Updated: October 25, 2025** - This system now maps TV Network IDs to Watch Provider IDs in TMDB. This provides better results by showing movies available on a streaming service rather than movies produced by a company.

**Example:** Netflix has:
- Network ID: `213` (for TV shows)
- Watch Provider ID: `8` (for movies available on Netflix)

**Previous Approach:** We used to map to Production Company IDs (`2354` for Netflix Productions), but this returned limited and inconsistent results because it included any company involvement (production, distribution, co-production).

**Current Approach:** Using Watch Provider IDs shows movies currently available to stream, which better matches user expectations of "Netflix Movies" = "Movies available on Netflix."

## Files

- **`src/components/Discover/DiscoverNetworkEnhanced/index.tsx`** - The mapping configuration (NETWORK_TO_PROVIDER_MAP)
- **`server/routes/discover.ts`** - Discover routes that support watchProviders parameter
- **`docs/provider-ids-reference.md`** - Complete provider ID reference

## Keeping Mappings Up to Date

### 1. Regular Validation (Monthly)

Run the validation script to check all mappings:

```bash
npm run validate:mappings
```

This script:
- Fetches network details from TMDB
- Fetches company details from TMDB  
- Verifies both IDs are valid
- Reports any broken mappings

### 2. When to Add New Mappings

Add new mappings when:
- **User reports missing movies** on a network page
- **New streaming service launches** (Disney+, Paramount+, etc.)
- **TMDB changes their structure** (rare but possible)
- **You notice empty movie sections** on network pages

### 3. How to Find IDs

#### Finding Network IDs:

**Method 1: From your app**
1. Navigate to network page: `/discover/tv/network/:id`
2. The ID is in the URL

**Method 2: TMDB website**
1. Go to https://www.themoviedb.org
2. Search for the network (e.g., "HBO")
3. Click on the network
4. ID is in URL: `https://www.themoviedb.org/network/49-hbo`

**Method 3: TMDB API**
```bash
curl "https://api.themoviedb.org/3/search/company?query=Netflix&api_key=YOUR_KEY"
```

#### Finding Production Company IDs:

**Method 1: From a movie**
1. Find a movie produced by that company on TMDB
2. Look at the movie's production companies
3. Note the company ID

**Method 2: TMDB API**
```bash
# Get movie details
curl "https://api.themoviedb.org/3/movie/791373?api_key=YOUR_KEY"

# Look for production_companies array:
{
  "production_companies": [
    {
      "id": 2354,
      "name": "Netflix"
    }
  ]
}
```

**Method 3: Company search**
```bash
curl "https://api.themoviedb.org/3/search/company?query=Netflix&api_key=YOUR_KEY"
```

### 4. Adding a New Mapping

1. **Find the IDs** (using methods above)

2. **Add to mapping file:**
   ```typescript
   // server/constants/networkCompanyMapping.ts
   export const NETWORK_TO_COMPANY_ID: Record<number, number> = {
     // ... existing mappings
     
     // New Streaming Service
     1234: 5678, // StreamCo (TV Network) -> StreamCo Productions (Company)
   };
   ```

3. **Validate the mapping:**
   ```bash
   npm run validate:mappings
   ```

4. **Test in the app:**
   - Restart the dev server
   - Navigate to `/discover/tv/network/1234`
   - Scroll to "Movies" section
   - Verify movies appear

### 5. Automated Monitoring (Optional)

Set up a cron job or CI workflow to run validation weekly:

**GitHub Actions Example:**
```yaml
name: Validate Network Mappings
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: npm run validate:mappings
```

## Common Issues

### Movies Not Showing on Network Page

**Symptoms:** Network page loads but "Movies" section is empty or shows wrong content

**Solutions:**
1. Check if network has a company mapping
2. Verify the company ID is correct
3. Check TMDB directly - does this network produce movies?
4. Try different company IDs from TMDB search results

### Wrong Movies Appearing

**Symptoms:** Movies from different studios showing up

**Solutions:**
1. The company ID might be incorrect
2. TMDB might have incorrect data (report to TMDB)
3. Check if there are multiple companies with similar names

### Validation Script Fails

**Symptoms:** `npm run validate:mappings` shows errors

**Solutions:**
1. Check if TMDB API is accessible
2. Verify the IDs still exist in TMDB
3. Network/company might have been merged or deleted
4. Update the mapping with new IDs

## Best Practices

1. **Document changes** - Add comments explaining why a mapping exists
2. **Test thoroughly** - Always check network pages after adding mappings
3. **Use validation script** - Run before committing mapping changes
4. **Keep it minimal** - Only add mappings when needed
5. **Update regularly** - Check mappings monthly or when issues reported

## Support

If you're unsure about a mapping:
1. Check TMDB forums or documentation
2. Look at movie production companies on TMDB
3. Compare with other similar networks
4. Test with validation script before committing

## Last Updated

October 2025 - Initial maintenance guide created

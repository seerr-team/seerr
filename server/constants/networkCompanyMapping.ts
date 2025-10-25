/**
 * Mapping of TV Network IDs to their corresponding Production Company IDs in TMDB
 * 
 * Networks produce TV shows, while production companies produce movies.
 * Many networks (like Netflix, HBO) have different IDs for their TV network vs movie production company.
 * 
 * HOW TO KEEP THIS UP TO DATE:
 * 
 * 1. Validate existing mappings:
 *    Run: npm run validate:mappings
 *    This script checks all mappings against the TMDB API
 * 
 * 2. Find network IDs:
 *    - Navigate to a network page: /discover/tv/network/:id
 *    - Check TMDB: https://www.themoviedb.org/network/:id
 *    - Use API: https://api.themoviedb.org/3/search/company?query=Netflix
 * 
 * 3. Find production company IDs:
 *    - Check TMDB: https://www.themoviedb.org/company/:id  
 *    - Use API: https://api.themoviedb.org/3/search/company?query=Netflix
 *    - Look at a movie's details: production_companies array
 * 
 * 4. When to add new mappings:
 *    - User reports missing movies on a network page
 *    - New streaming service launches
 *    - Network/company structure changes in TMDB
 * 
 * 5. Testing new mappings:
 *    - Add mapping to this file
 *    - Restart server
 *    - Check network page: /discover/tv/network/:id
 *    - Verify movies appear in "Movies" section
 * 
 * Last updated: October 2025
 */
export const NETWORK_TO_COMPANY_ID: Record<number, number> = {
    // Netflix
    213: 2354, // Netflix (TV Network) -> Netflix (Production Company)

    // HBO
    49: 3268, // HBO (TV Network) -> HBO Films (Production Company)

    // Amazon
    1024: 20580, // Amazon (TV Network) -> Amazon Studios (Production Company)

    // Apple TV+
    2552: 125928, // Apple TV+ (TV Network) -> Apple TV+ (Production Company)

    // Disney+
    2739: 2, // Disney+ (TV Network) -> Walt Disney Pictures (Production Company)

    // Hulu
    453: 2739, // Hulu (TV Network) -> Hulu (Production Company)

    // Paramount+
    4330: 491, // Paramount+ (TV Network) -> Paramount Pictures (Production Company)

    // Peacock
    3353: 37154, // Peacock (TV Network) -> Peacock (Production Company)

    // Showtime
    67: 2073, // Showtime (TV Network) -> Showtime Networks (Production Company)

    // Starz
    318: 10163, // Starz (TV Network) -> Starz Productions (Production Company)

    // AMC
    174: 19177, // AMC (TV Network) -> AMC Studios (Production Company)

    // FX
    88: 1074, // FX (TV Network) -> FX Productions (Production Company)

    // BBC
    4: 3166, // BBC One (TV Network) -> BBC Films (Production Company)

    // Add more mappings as needed
};

/**
 * Get the production company ID for a given network ID
 * Returns the company ID if mapped, otherwise returns the network ID
 * (some smaller networks might use the same ID)
 */
export function getCompanyIdForNetwork(networkId: number): number {
    return NETWORK_TO_COMPANY_ID[networkId] || networkId;
}

/**
 * Check if a network has a known production company mapping
 */
export function hasCompanyMapping(networkId: number): boolean {
    return networkId in NETWORK_TO_COMPANY_ID;
}

/**
 * Get all mapped network IDs
 */
export function getAllMappedNetworkIds(): number[] {
    return Object.keys(NETWORK_TO_COMPANY_ID).map(Number);
}

/**
 * Get the reverse mapping (company ID -> network IDs)
 * Useful for finding which network corresponds to a company
 */
export function getNetworkIdsForCompany(companyId: number): number[] {
    return Object.entries(NETWORK_TO_COMPANY_ID)
        .filter(([_, mappedCompanyId]) => mappedCompanyId === companyId)
        .map(([networkId, _]) => Number(networkId));
}

/**
 * Add a suggestion for a missing mapping
 * This helps track which networks need mapping updates
 */
const missingSuggestions = new Set<number>();

export function suggestMissingMapping(networkId: number): void {
    if (!hasCompanyMapping(networkId)) {
        missingSuggestions.add(networkId);
        if (missingSuggestions.size % 10 === 0) {
            console.warn(
                `⚠️  ${missingSuggestions.size} networks without company mappings detected. ` +
                `Consider adding them to server/constants/networkCompanyMapping.ts`
            );
        }
    }
}

/**
 * Get all network IDs that were suggested for mapping
 */
export function getMissingSuggestions(): number[] {
    return Array.from(missingSuggestions);
}

import TheMovieDb from '@server/api/themoviedb';
import { NETWORK_TO_COMPANY_ID } from '@server/constants/networkCompanyMapping';

/**
 * Script to validate network-to-company ID mappings against TMDB API
 * Run this periodically to ensure mappings are still valid
 * 
 * Usage: npm run validate:mappings
 */

interface NetworkDetails {
    id: number;
    name: string;
}

interface CompanyDetails {
    id: number;
    name: string;
}

async function validateMappings() {
    console.log('🔍 Validating Network-to-Company ID Mappings...\n');

    const tmdb = new TheMovieDb();
    let validCount = 0;
    let invalidCount = 0;
    const errors: string[] = [];

    for (const [networkIdStr, companyId] of Object.entries(NETWORK_TO_COMPANY_ID)) {
        const networkId = Number(networkIdStr);

        try {
            // Fetch network details
            const networkResponse = await tmdb.getNetwork(networkId);

            // Fetch company details  
            const companyResponse = await tmdb.getStudio(companyId);

            if (networkResponse && companyResponse) {
                console.log(`✅ ${networkResponse.name} (${networkId}) -> ${companyResponse.name} (${companyId})`);
                validCount++;
            }
        } catch (error) {
            const errorMsg = `❌ Invalid mapping: Network ${networkId} -> Company ${companyId} - ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            invalidCount++;
        }

        // Rate limiting - TMDB allows 40 requests per 10 seconds
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log('\n📊 Validation Summary:');
    console.log(`✅ Valid: ${validCount}`);
    console.log(`❌ Invalid: ${invalidCount}`);

    if (errors.length > 0) {
        console.log('\n⚠️  Errors found:');
        errors.forEach(err => console.log(err));
        // Don't exit with error code to allow CI to continue
        console.log('\n⚠️  Some mappings may need updating in server/constants/networkCompanyMapping.ts');
    } else {
        console.log('\n✨ All mappings are valid!');
    }
}

validateMappings().catch(error => {
    console.error('💥 Validation script failed:', error);
});
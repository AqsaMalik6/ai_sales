/**
 * emailPatternGenerator.ts
 * Generates email patterns and attempts to find company domains
 */

export interface GeneratedEmail {
    email: string;
    pattern: string;
    status: 'valid' | 'invalid' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
}

export interface PatternResult {
    generated_emails: GeneratedEmail[];
    best_guess: string | null;
}

export const generateEmailPatterns = (firstName: string, lastName: string, domain: string): string[] => {
    const f = firstName.toLowerCase().trim();
    const l = lastName.toLowerCase().trim();
    const d = domain.toLowerCase().trim();

    if (!f || !d) return [];

    return [
        `${f}@${d}`,                          // 1. firstname@domain.com
        `${l}@${d}`,                          // 2. lastname@domain.com
        `${f}.${l}@${d}`,                     // 3. firstname.lastname@domain.com
        `${f.charAt(0)}.${l}@${d}`,           // 4. f.lastname@domain.com
        `${f}${l}@${d}`,                      // 5. firstnamelastname@domain.com
        `${f.charAt(0)}${l}@${d}`,            // 6. flastname@domain.com
        `${f}_${l}@${d}`,                     // 7. firstname_lastname@domain.com
        `${f}-${l}@${d}`,                     // 8. firstname-lastname@domain.com
    ];
};

export const findCompanyDomain = async (companyName: string): Promise<string | null> => {
    if (!companyName || companyName === 'No Company Data') return null;

    try {
        // Search LinkedIn company page via background to find website
        const response: any = await chrome.runtime.sendMessage({
            action: 'SEARCH_DOMAIN',
            companyName: companyName
        });

        if (response && response.domain) {
            return response.domain;
        }
        return null;
    } catch (e) {
        console.error("Error finding company domain:", e);
        return null;
    }
};

export const getFirstLastName = (fullName: string): { first: string, last: string } => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '' };
    return {
        first: parts[0],
        last: parts[parts.length - 1]
    };
};

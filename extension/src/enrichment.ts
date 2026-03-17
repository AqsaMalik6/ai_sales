/**
 * enrichment.ts
 * Module for extracting phone numbers and emails from external profile links
 */

export interface EnrichmentResult {
    phone?: string;
    email?: string;
    source: string;
    sourceType: string;
    confidence: 'high' | 'low';
}

const PHONE_REGEX = /(\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,6}/g;
// More precise Email Regex to avoid mashing text
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;

export const performEnrichment = async (type: 'email' | 'phone'): Promise<EnrichmentResult | null> => {
    const urls = extractExternalLinks();
    if (urls.length === 0) return null;

    const results = await Promise.allSettled(urls.map(url => fetchAndScrape(url, type)));
    
    const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<EnrichmentResult> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
        .sort((a, b) => {
            if (a.confidence === 'high' && b.confidence === 'low') return -1;
            if (a.confidence === 'low' && b.confidence === 'high') return 1;
            return 0;
        });

    return successfulResults[0] || null;
};

const extractExternalLinks = (): string[] => {
    const urls = new Set<string>();

    // 1. Social Links from page
    document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"], a[href*="github.com"]').forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href) urls.add(href);
    });

    // 2. Links from the Intro Section (Portfolio/Globe icons)
    const introLinks = document.querySelectorAll('.pv-text-details__left-panel a[href^="http"], .pv-top-card--website a, .pv-top-card-list a[href^="http"]');
    introLinks.forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href && !href.includes('linkedin.com')) urls.add(href);
    });

    // 3. Links inside the Contact Info Modal (Hamza Sajid case)
    const modalLinks = document.querySelectorAll('.artdeco-modal a[href^="http"]');
    modalLinks.forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href && !href.includes('linkedin.com')) urls.add(href);
    });

    // 4. About section external URLs
    const aboutSection = document.querySelector('#about')?.parentElement;
    if (aboutSection) {
        const text = aboutSection.textContent || "";
        const urlMatches = text.match(/https?:\/\/[^\s$.?#].[^\s]*/g);
        if (urlMatches) urlMatches.forEach(url => urls.add(url));
    }

    return Array.from(urls).filter(url => !url.includes('linkedin.com'));
};

const fetchAndScrape = async (url: string, type: 'email' | 'phone'): Promise<EnrichmentResult | null> => {
    try {
        await new Promise(r => setTimeout(r, 400)); 

        const response: any = await chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL', url });
        if (!response || !response.html) return null;

        const html = response.html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove scripts and styles to avoid noise in bodyText
        const scripts = doc.querySelectorAll('script, style, nav, footer');
        scripts.forEach(s => s.remove());
        
        const bodyText = doc.body.innerText;

        if (type === 'email') {
            // Check mailto links FIRST (highest confidence)
            const mailtoLink = doc.querySelector('a[href^="mailto:"]');
            if (mailtoLink) {
                const email = mailtoLink.getAttribute('href')?.replace('mailto:', '').split('?')[0].trim();
                if (email && email.includes('@')) {
                    return { email: email, source: url, sourceType: 'portfolio', confidence: 'high' };
                }
            }

            // Strictly find only valid emails
            const emailMatches = bodyText.match(EMAIL_REGEX);
            if (emailMatches) {
                // Filter out common false positives
                const validEmail = emailMatches.find(e => !e.endsWith('.png') && !e.endsWith('.jpg') && e.length < 50);
                if (validEmail) {
                    return { email: validEmail, source: url, sourceType: 'portfolio', confidence: 'high' };
                }
            }
        }

        if (type === 'phone') {
            const telLink = doc.querySelector('a[href^="tel:"]');
            if (telLink) {
                const phone = telLink.getAttribute('href')?.replace('tel:', '').trim();
                if (phone && isValidPhone(phone)) {
                    return { phone, source: url, sourceType: 'portfolio', confidence: 'high' };
                }
            }

            const matches = bodyText.match(PHONE_REGEX);
            if (matches) {
                const validMatches = matches.filter(isValidPhone);
                if (validMatches.length > 0) {
                    const isNearKeyword = /contact|call|phone|mobile|whatsapp/i.test(bodyText);
                    return { 
                        phone: validMatches[0], 
                        source: url, 
                        sourceType: 'portfolio', 
                        confidence: isNearKeyword ? 'high' : 'low' 
                    };
                }
            }
        }

        return null;
    } catch (e) {
        return null;
    }
};

const isValidPhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return false;
    if (/^(2020|2021|2022|2023|2024|2025|2026)$/.test(digits)) return false;
    return true;
};

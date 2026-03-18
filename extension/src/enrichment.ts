/**
 * enrichment.ts
 * Module for advanced extraction of phone numbers and emails from external profile links
 */

export interface EnrichmentResult {
    phone?: string;
    email?: string;
    source: string;
    sourceType: string;
    confidence: 'high' | 'low';
}

const PHONE_REGEX = /(\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,6}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;

export const performEnrichment = async (type: 'email' | 'phone', extraUrls: string[] = []): Promise<EnrichmentResult | null> => {
    // 1. Get all potential external urls (Portfolio, Twitter, Company sites etc.)
    const pageUrls = extractAllAvailableLinks();
    
    // Combine urls and remove duplicates, prioritizing extraUrls
    const urls = Array.from(new Set([...extraUrls, ...pageUrls])).slice(0, 5);
    
    if (urls.length === 0) return null;

    // 2. Perform parallel fetching with slight staggered delays
    const results = await Promise.allSettled(urls.map(url => deepFetchAndScrape(url, type)));
    
    // 3. Return the best match (High confidence first)
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

const extractAllAvailableLinks = (): string[] => {
    const urls = new Set<string>();

    // A. Social & Direct Links
    document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"], a[href*="github.com"], a[href*="facebook.com"], a[href*="instagram.com"]').forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href) urls.add(href);
    });

    // B. Intro/Headline Section (Portfolio, Website)
    const introSelectors = [
        '.pv-text-details__left-panel a[href^="http"]', 
        '.pv-top-card--website a', 
        '.pv-top-card-list a[href^="http"]',
        'a[href*="portfolio"]'
    ];
    introSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            const href = (el as HTMLAnchorElement).href;
            if (href && !href.includes('linkedin.com')) urls.add(href);
        });
    });

    // C. Experience Section (Company Websites)
    const experienceLogos = document.querySelectorAll('.pvs-entity__logo a[href*="linkedin.com/company/"]');
    experienceLogos.forEach(el => {
        // We can't easily fetch other linkedin pages in background, but we can try to guess company domain from name
        const companyName = el.closest('.pvs-entity')?.querySelector('.t-bold span')?.textContent?.trim()?.toLowerCase() || '';
        if (companyName && companyName !== 'no company data') {
            // Logic to potentially search/guess could go here, but for now we rely on the Profile already having these links
        }
    });

    // D. Contact Info Modal (Including Websites, Blogs, etc.)
    const modalLinks = document.querySelectorAll('.artdeco-modal a[href^="http"]');
    modalLinks.forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href && !href.includes('linkedin.com')) urls.add(href);
    });

    // E. About section (Manual URL scanning)
    const aboutSection = document.querySelector('#about')?.parentElement;
    if (aboutSection) {
        const text = aboutSection.innerText || "";
        const urlMatches = text.match(/https?:\/\/[^\s$.?#].[^\s]*/g);
        if (urlMatches) urlMatches.forEach(url => urls.add(url.replace(/[),.]$/, '')));
    }

    return Array.from(urls).filter(url => !url.includes('linkedin.com')).slice(0, 5); // Limit to top 5 links for speed
};

const deepFetchAndScrape = async (url: string, type: 'email' | 'phone'): Promise<EnrichmentResult | null> => {
    try {
        // Initial fetch (homepage or bio)
        let result = await fetchAndScrape(url, type);
        if (result) return result;

        // "Intelligent Behavior": If it's a website and no info found, try to find a /contact or /about page
        if (!url.includes('twitter.com') && !url.includes('x.com') && !url.includes('github.com')) {
            const response: any = await chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL', url });
            if (response && response.html) {
                const doc = new DOMParser().parseFromString(response.html, 'text/html');
                const contactLink = Array.from(doc.querySelectorAll('a')).find(a => 
                    /contact|about|connect|reach/i.test(a.innerText) || /contact|about/i.test(a.href)
                );
                
                if (contactLink) {
                    let subUrl = contactLink.href;
                    if (subUrl.startsWith('/')) {
                        const origin = new URL(url).origin;
                        subUrl = origin + subUrl;
                    }
                    if (subUrl.startsWith('http') && subUrl !== url) {
                        return await fetchAndScrape(subUrl, type);
                    }
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

const fetchAndScrape = async (url: string, type: 'email' | 'phone'): Promise<EnrichmentResult | null> => {
    try {
        await new Promise(r => setTimeout(r, 400)); 
        const response: any = await chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL', url });
        if (!response || !response.html) return null;

        const html = response.html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Clean up page
        doc.querySelectorAll('script, style, nav, footer, iframe, noscript').forEach(s => s.remove());
        const bodyText = doc.body.innerText;

        if (type === 'email') {
            // 1. Mailto links
            const mailtoLink = doc.querySelector('a[href^="mailto:"]');
            if (mailtoLink) {
                const email = mailtoLink.getAttribute('href')?.replace('mailto:', '').split('?')[0].trim();
                if (email && email.includes('@')) return { email, source: url, sourceType: 'website', confidence: 'high' };
            }

            // 2. Regex scan
            const emailMatches = bodyText.match(EMAIL_REGEX);
            if (emailMatches) {
                const validEmail = emailMatches.find(e => !/\.(png|jpg|jpeg|gif|css|js|svg)$/i.test(e) && e.length < 50);
                if (validEmail) return { email: validEmail, source: url, sourceType: 'website', confidence: 'high' };
            }
        }

        if (type === 'phone') {
            // 1. Tel links
            const telLink = doc.querySelector('a[href^="tel:"]');
            if (telLink) {
                const phone = telLink.getAttribute('href')?.replace('tel:', '').trim();
                if (phone && isValidPhone(phone)) return { phone, source: url, sourceType: 'website', confidence: 'high' };
            }

            // 2. Regex scan near keywords
            const matches = bodyText.match(PHONE_REGEX);
            if (matches) {
                const validMatches = matches.filter(isValidPhone);
                if (validMatches.length > 0) {
                    const isNearKeyword = /contact|call|phone|mobile|whatsapp|reach|tel/i.test(bodyText);
                    return { 
                        phone: validMatches[0], 
                        source: url, 
                        sourceType: 'website', 
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

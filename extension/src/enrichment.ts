import { EnrichmentResult } from './content';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g; // Permissive TLDs
const OBFUSCATED_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+(?:\s*(?:@|\[at\]|\(at\))\s*)[a-zA-Z0-9.-]+(?:\s*(?:\.|\[dot\]|\(dot\))\s*)[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d{1,4}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,9}/g;

export const findCompanyDomain = async (companyName: string): Promise<string | null> => {
    if (!companyName || companyName.toLowerCase().includes('freelance') || companyName.toLowerCase().includes('self-employed')) return null;
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'SEARCH_DOMAIN', companyName }, (response) => {
            resolve(response?.domain || null);
        });
    });
};

export const getFirstLastName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return {
        first: parts[0] || '',
        last: parts.length > 1 ? parts[parts.length - 1] : ''
    };
};

export const generateEmailPatterns = (first: string, last: string, domain: string): string[] => {
    const f = first.toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = last.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!f || !domain) return [];
    
    const patterns = [
        `${f}@${domain}`,
        `${f}.${l}@${domain}`,
        `${f}${l}@${domain}`,
        `${f[0]}${l}@${domain}`,
        `${f}${l[0]}@${domain}`
    ];
    return [...new Set(patterns)];
};

export const verifyEmailsBatch = async (emails: string[]): Promise<{ email: string, status: 'valid' | 'invalid' | 'unknown' }[]> => {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'VERIFY_EMAILS', emails }, (response) => {
            resolve(response?.results || []);
        });
    });
};

export const discoverPortfolioUrls = (pageText: string): string[] => {
    const urls = new Set<string>();
    // Look for common personal site patterns
    const urlMatches = pageText.match(/https?:\/\/[^\s"'<>]+/g);
    if (urlMatches) {
        urlMatches.forEach(url => {
            const low = url.toLowerCase();
            const blacklist = ['linkedin.com', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'static', 'media', 'wp-content'];
            if (!blacklist.some(skip => low.includes(skip))) {
                // Heuristic: portfolios often have /portfolio, /me, /bio, or are top-level domains
                if (low.includes('portfolio') || low.includes('about') || low.includes('github.io') || 
                    low.includes('behance.net') || low.includes('dribbble.com') || low.split('/').length <= 4) {
                    urls.add(url.replace(/[.,;]$/, ''));
                }
            }
        });
    }

    return Array.from(urls).filter(url => !url.includes('linkedin.com')).slice(0, 10);
};

// Perform deep scraping on a list of URLs to find specific data
export const performEnrichment = async (type: 'email' | 'phone', urls: string[]): Promise<EnrichmentResult | null> => {
    const targets = [...new Set(urls)]
        .map(u => u?.trim())
        .filter(u => u && !u.includes('linkedin.com') && u.startsWith('http'));

    if (targets.length === 0) return null;

    console.log(`Deep Enrichment (${type}) starting for:`, targets);
    const results: EnrichmentResult[] = [];
    const visited = new Set<string>();

    for (const url of targets) {
        if (visited.size > 20) break;
        const res = await deepFetchAndScrape(type, url, visited);
        if (res) results.push(res);
    }

    if (results.length > 0) {
        results.sort((a, b) => {
            const aConf = a.confidence === 'high' ? 2 : 1;
            const bConf = b.confidence === 'high' ? 2 : 1;
            if (aConf !== bConf) return bConf - aConf;

            if (type === 'email') {
                const aE = a.email?.toLowerCase() || '';
                const bE = b.email?.toLowerCase() || '';
                const aG = aE.includes('gmail.com');
                const bG = bE.includes('gmail.com');
                if (aG && !bG) return -1;
                if (!aG && bG) return 1;
                const personal = /shradha|contact|hello|me@|hi@|connect/i;
                if (personal.test(aE) && !personal.test(bE)) return -1;
                if (!personal.test(aE) && personal.test(bE)) return 1;
            }
            return 0;
        });
        return { ...results[0], allEmails: [...new Set(results.flatMap(r => r.allEmails || []))] };
    }
    return null;
};

async function deepFetchAndScrape(type: 'email' | 'phone', url: string, visited: Set<string>): Promise<EnrichmentResult | null> {
    if (visited.has(url) || visited.size > 20) return null;
    visited.add(url);

    try {
        const initial = await fetchAndScrape(type, url);
        if (initial && initial.confidence === 'high') return initial;

        const isSocial = /twitter\.com|facebook\.com|instagram\.com|github\.com|linkedin\.com/i.test(url);
        if (!isSocial && url.startsWith('http')) {
            const domain = new URL(url).origin;
            const res = await new Promise<any>(r => chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL', url }, r));
            const html = res?.html || '';
            const contactPaths: string[] = [];
            const matches = html.matchAll(/href="([^"]*(contact|about|team|reach|legal|support|bio)[^"]*)"/ig);
            for (const m of matches) {
                let path = m[1];
                if (!path.startsWith('http')) {
                    if (path.startsWith('/')) path = domain + path;
                    else path = domain + '/' + path;
                }
                if (!visited.has(path) && contactPaths.length < 5) contactPaths.push(path);
            }

            const commonPaths = ['/contact', '/about', '/contact-us', '/about-us', '/me', '/team'].map(p => domain + p);
            const allToTry = [...new Set([...contactPaths, ...commonPaths])].filter(p => !visited.has(p));

            for (const subUrl of allToTry) {
                if (visited.size > 20) break;
                visited.add(subUrl);
                const subResult = await fetchAndScrape(type, subUrl);
                if (subResult && (subResult.confidence === 'high' || !initial)) return subResult;
            }
        }
        return initial;
    } catch (e) {
        return null;
    }
}

async function fetchAndScrape(type: 'email' | 'phone', url: string): Promise<EnrichmentResult | null> {
    try {
        const response = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL', url }, (res) => resolve(res));
        });

        if (!response || response.error || !response.html) return null;

        const doc = new DOMParser().parseFromString(response.html, 'text/html');
        // DO NOT remove footer as contact info is often there
        doc.querySelectorAll('script, style, iframe, noscript, svg, path').forEach(s => s.remove());
        const bodyText = doc.body.innerText;

        if (type === 'email') {
            const emails = new Set<string>();
            doc.querySelectorAll('a[href^="mailto:"]').forEach(a => {
                const e = (a as HTMLAnchorElement).href.replace('mailto:', '').split('?')[0].trim();
                if (e.includes('@')) emails.add(e.toLowerCase());
            });
            const textMatches = (bodyText.match(EMAIL_REGEX) || ([] as string[])).concat(bodyText.match(OBFUSCATED_EMAIL_REGEX) || []);
            textMatches.forEach(m => {
                const e = m.toLowerCase().replace(/\s*(\[at\]|\(at\))\s*/g, '@').replace(/\s*(\[dot\]|\(dot\))\s*/g, '.').trim();
                if (e.includes('@') && !/\.(png|jpg|jpeg|gif|css|js|svg|webp|ico|woff|woff2|ttf|pdf|zip|mp4|webm)$/i.test(e) && e.length < 60) {
                    emails.add(e);
                }
            });

            if (emails.size > 0) {
                const arr = Array.from(emails);
                const best = arr.find(e => /shradha|hello|contact|me@|gmail/i.test(e)) || arr[0];
                return { 
                    email: best, 
                    emails: arr, // Return all found emails
                    allEmails: arr, // For backward compatibility with my prev edit
                    source: url, 
                    sourceType: 'website', 
                    confidence: best.includes('@') ? 'high' : 'low' 
                };
            }
        }

        if (type === 'phone') {
            const phoneMatches = bodyText.match(PHONE_REGEX);
            if (phoneMatches) {
                const valid = phoneMatches.find(p => {
                    const digits = p.replace(/\D/g, '');
                    return digits.length >= 10 && digits.length <= 15;
                });
                if (valid) {
                    const isNearKeyword = /contact|call|phone|mobile|whatsapp|reach|tel/i.test(bodyText);
                    return { phone: valid.trim(), source: url, sourceType: 'website', confidence: isNearKeyword ? 'high' : 'low' };
                }
            }
        }

        return null;
    } catch (e) {
        return null;
    }
}

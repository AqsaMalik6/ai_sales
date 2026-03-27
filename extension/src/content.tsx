import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { performEnrichment } from './enrichment';
import { generateEmailPatterns, findCompanyDomain, getFirstLastName } from './emailPatternGenerator';
import { verifyEmailsBatch } from './smtpClient';

interface ContactData {
    fullName: string;
    jobTitle: string;
    company: string;
    profilePhoto: string;
    linkedinUrl: string;
    headline: string;
    location: string;
    about: string;
    experience: string;
    education: string;
    services: string;
    email?: string;
    emails?: string[];
    phone?: string;
    phoneSource?: string;
    phoneSourceUrl?: string;
    phoneConfidence?: 'high' | 'low';
    emailSource?: string;
    emailSourceUrl?: string;
    emailConfidence?: 'high' | 'low';
}
export interface EnrichmentResult {
    email?: string;
    emails?: string[];
    allEmails?: string[];
    phone?: string;
    source: string;
    sourceType: string;
    confidence: 'high' | 'low';
}

const Sidebar: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [contact, setContact] = useState<ContactData | null>(null);
    const [loadingEnrich, setLoadingEnrich] = useState(false);
    const [listName, setListName] = useState('');
    const [activeTab, setActiveTab] = useState<'Person' | 'Company'>('Person');
    const [showAddListInput, setShowAddListInput] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [smtpOffline, setSmtpOffline] = useState(false);

    useEffect(() => {
        // Check SMTP server status via Background Script (to bypass CSP)
        const checkSmtp = () => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ action: 'CHECK_SMTP_STATUS' }, (response) => {
                    if (response && response.online) setSmtpOffline(false);
                    else setSmtpOffline(true);
                });
            }
        };

        checkSmtp();
        const smtpInterval = setInterval(checkSmtp, 10000);

        const messageListener = (message: any) => {
            if (message.action === 'TOGGLE_SIDEBAR') {
                setIsVisible(prev => !prev);
            }
            if (message.action === 'SYNC_FROM_EXTENSION') {
                console.log('Synchronizing dashboard data from background message...');
                window.postMessage({ type: 'SYNC_FROM_EXTENSION', data: message.data }, '*');
            }
        };

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(messageListener);
            return () => {
                chrome.runtime.onMessage.removeListener(messageListener);
                clearInterval(smtpInterval);
            };
        }
    }, []);

    const getNormalizedUrl = (url: string) => {
        try {
            const u = new URL(url);
            return u.origin + u.pathname.replace(/\/$/, "");
        } catch (e) {
            return url.split('?')[0].replace(/\/$/, "");
        }
    };

    const scrapeData = () => {
        try {
            // EXTREMELY Robust Name Selectors
            const nameSelectors = [
                'h1.text-heading-xlarge',
                'h1.t-24.t-black.t-bold.break-words',
                '.pv-text-details__left-panel h1',
                'h1.inline.t-24.v-align-middle.break-words',
                '.text-heading-xlarge',
                'main#main h1',
                '[data-field="name"]',
                '.pv-top-card--list:first-child h1',
                'h1'
            ];
            let fullName = '';
            for (const selector of nameSelectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent?.trim()) {
                    const text = el.textContent.trim().split(/\s+·\s+/)[0]; // Remove degree (e.g. Sana Ikram · 1st)
                    if (text && text.toLowerCase() !== 'contact info' && text.length < 100 && text.length > 2 && !text.includes('LinkedIn')) {
                        fullName = text;
                        break;
                    }
                }
            }

            // Desperate Name Fallback: Document Title
            if (!fullName && document.title && document.title.includes('|')) {
                const titleName = document.title.split('|')[0].trim();
                // Ensure titleName is not the company name from title
                if (titleName && !titleName.includes('LinkedIn')) fullName = titleName;
            }

            // Robust Job/Headline Selectors
            // Robust Job/Headline Selectors
            const jobTitle = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
                document.querySelector('.pv-text-details__left-panel .text-body-medium')?.textContent?.trim() ||
                document.querySelector('meta[name="description"]')?.getAttribute('content')?.split('·')[1]?.trim() ||
                document.querySelector('.text-body-medium')?.textContent?.trim() ||
                document.querySelector('[data-field="headline"]')?.textContent?.trim() ||
                document.querySelector('main#main .text-body-medium span')?.textContent?.trim() ||
                document.title.split('|')[1]?.trim() || ''; // Fallback to window title part

            const headline = jobTitle;
            let currentJobTitle = headline; // Default to headline
            let companyText = '';

            // PRIORITY 1: Right side of profile name (Top Card)
            const topCardCompany = document.querySelector('a[data-field="parent_company_display_name"]') ||
                document.querySelector('.pv-text-details__right-panel-item-text') ||
                document.querySelector('.pv-text-details__right-panel li button span') ||
                document.querySelector('.pv-top-card--experience-list-item');

            if (topCardCompany && topCardCompany.textContent?.trim()) {
                const text = topCardCompany.textContent.trim();
                const isAction = text.toLowerCase() === 'follow' || text.toLowerCase() === 'message' || text.toLowerCase() === 'connect';
                // Allow Universities as companies, but filter out pure action buttons
                if (!isAction && text.length > 2) {
                    companyText = text;
                }
            }

            // PRIORITY 2: Top of Experience Section (Header Discovery)
            if (!companyText) {
                const sections = Array.from(document.querySelectorAll('section'));
                const expSec = sections.find(s => {
                    const h2 = s.querySelector('h2');
                    return h2 && h2.textContent?.toLowerCase().includes('experience');
                }) || document.getElementById('experience')?.closest('section') as HTMLElement | null;

                if (expSec) {
                    const firstItem = expSec.querySelector('ul.pvs-list > li') || expSec.querySelector('.pvs-list__item');
                    if (firstItem) {
                        const allSpans = Array.from(firstItem.querySelectorAll('span[aria-hidden="true"], .t-bold'))
                            .map(s => s.textContent?.trim() || '')
                            .filter(t => t.length > 2 && !t.includes('Present') && !t.includes('yrs') && !t.includes('mos'));

                        if (allSpans.length >= 2) {
                            // If index 1 has a bullet, split it: "Company · Full-time"
                            let rawCompany = allSpans[1];
                            if (rawCompany.includes('·')) rawCompany = rawCompany.split('·')[0].trim();

                            // If first item looks like a company name but second is a title (usually the other way)
                            if (allSpans[1].toLowerCase().includes('yrs') || allSpans[1].toLowerCase().includes('mos')) {
                                companyText = allSpans[0];
                            } else {
                                companyText = rawCompany;
                            }
                        } else if (allSpans.length === 1) {
                            companyText = allSpans[0];
                        }
                    }
                }
            }

            if (!companyText) {
                const companySelectors = [
                    'button[data-field="experience_company_logo"]',
                    'div[aria-label="Current company"]',
                    '.artdeco-entity-lockup__subtitle',
                    '#experience ~ div .pvs-entity span[aria-hidden="true"]',
                    '[data-field="current_company_display_name"]',
                    'a[href*="/company/"] span:not(.visually-hidden)',
                    '.pv-entity__secondary-title',
                    '.pv-top-card--experience-list-item span'
                ];

                for (const selector of companySelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent?.trim()) {
                        const text = el.textContent.trim();
                        if (text.length < 100 && text.length > 2 && !text.includes('·') && !text.toLowerCase().includes('followers') && text.toLowerCase() !== 'follow') {
                            companyText = text;
                            break;
                        }
                    }
                }
            }

            // Sync jobTitle with the extracted role if found in priority 2
            const experienceTitle = document.querySelector('#experience ~ div .pvs-entity span[aria-hidden="true"]')?.textContent?.trim() ||
                document.querySelector('section#experience-section ul li span:nth-child(1)')?.textContent?.trim();
            if (experienceTitle && experienceTitle.length < 80) currentJobTitle = experienceTitle;

            const profilePhoto = (document.querySelector('.pv-top-card-profile-picture__image') as HTMLImageElement)?.src ||
                (document.querySelector('.pv-top-card-profile-picture img') as HTMLImageElement)?.src ||
                (document.querySelector('.pv-top-card--photo img') as HTMLImageElement)?.src || '';
            const linkedinUrl = getNormalizedUrl(window.location.href);
            // HIGHLY ROBUST LOCATION DISCOVERY
            let extractedLocation = "";

            // Method 1: Surgical sibling extraction near Contact Info
            const contactInfoBtn = Array.from(document.querySelectorAll('a, button')).find(el => (el as HTMLElement).innerText?.toLowerCase().includes('contact info'));
            if (contactInfoBtn) {
                const parentText = contactInfoBtn.parentElement?.innerText || "";
                // Clean the text: remove "Contact info", separators, and trim
                const clean = parentText.replace(/contact info/gi, '').replace(/[·•]/g, '').trim();
                if (clean && clean.length > 2 && clean.length < 100 && !clean.toLowerCase().includes('connection') && !clean.toLowerCase().includes('follower')) {
                    extractedLocation = clean;
                }
            }

            // Method 2: Specific CSS Selectors (LinkedIn Standard)
            if (!extractedLocation) {
                const locSelectors = [
                    '.text-body-small.inline.t-black--light.break-words',
                    '.pv-text-details__left-panel .text-body-small',
                    '.pv-top-card--list-bullet .text-body-small',
                    'span.text-body-small.v-align-middle.break-words',
                    '.ph5 .mt2 span.text-body-small'
                ];
                for (const sel of locSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent?.trim() && el.textContent.trim().length > 2) {
                        extractedLocation = el.textContent.trim();
                        break;
                    }
                }
            }

            const location = extractedLocation || "Not specified";

            // Robust About Section Discovery
            let aboutText = '';
            const allSections = Array.from(document.querySelectorAll('section'));
            // 1. Find section by H2 header
            let aboutSection = allSections.find(s => {
                const h2 = s.querySelector('h2');
                const text = h2?.textContent?.trim().toLowerCase();
                return text === 'about' || text?.includes('about this profile');
            }) || document.getElementById('about')?.closest('section');

            // 2. If not found, try common about section classes
            if (!aboutSection) {
                aboutSection = (document.querySelector('.pv-about-section') as HTMLElement) ||
                    (document.querySelector('section.pv-profile-card--about') as HTMLElement);
            }

            if (aboutSection) {
                const contentSelectors = [
                    '.inline-show-more-text span[aria-hidden="true"]',
                    '.inline-show-more-text',
                    '.pv-shared-text-with-see-more span[aria-hidden="true"]',
                    '.pv-shared-text-with-see-more',
                    '.t-14.t-black.t-normal.break-words span[aria-hidden="true"]',
                    'div > span[aria-hidden="true"]',
                    'span'
                ];

                for (const sel of contentSelectors) {
                    const el = aboutSection.querySelector(sel);
                    if (el && el.textContent?.trim()) {
                        const text = el.textContent.trim().replace(/\s+/g, ' ');
                        // Ensure it's substantial and not just the header text
                        if (text.length > 10 && text.toLowerCase() !== 'about') {
                            aboutText = text;
                            break;
                        }
                    }
                }
            }

            // Fallback: If section found but content elusive, take everything but the header
            if (aboutSection && !aboutText) {
                const clone = aboutSection.cloneNode(true) as HTMLElement;
                clone.querySelector('h2')?.remove();
                clone.querySelector('button')?.remove(); // Remove "see more"
                aboutText = (clone as HTMLElement).innerText.trim().replace(/\s+/g, ' ');
            }

            const pageText = document.body.innerText;
            const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
            const PHONE_REGEX = /(?:\+?\d{1,3}[\s\. -])?\(?\d{2,4}\)?[\s\. -]?\d{3,4}[\s\. -]?\d{3,6}/g;

            const experienceStr = Array.from(document.querySelectorAll('#experience ~ div .pvs-entity, #experience ~ div .display-flex.flex-column.full-width')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');
            const educationStr = Array.from(document.querySelectorAll('#education ~ div .pvs-entity, #education ~ div .display-flex.flex-column.full-width')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');
            const servicesStr = document.querySelector('.pv-top-card--services')?.textContent?.trim() || '';

            let email = '';
            let phone = '';

            // Last resort: scan page text for emails/phones if they look like they belong to the profile
            if (pageText) {
                const emails = pageText.match(EMAIL_REGEX);
                if (emails) email = emails.find(e => !/\.(png|jpg|jpeg|gif|css|js|svg)$/i.test(e) && e.length < 50 && !e.includes('reply-to')) || '';

                const phones = pageText.match(PHONE_REGEX);
                if (phones) phone = phones.find(p => {
                    const d = p.replace(/\D/g, '');
                    return d.length >= 10 && d.length <= 15 && !/^(202|203|204|205|206)/.test(d);
                }) || '';
            }

            const currentContact: ContactData = {
                fullName,
                jobTitle: currentJobTitle || jobTitle || 'No Title',
                company: companyText || 'No Company Data',
                profilePhoto,
                linkedinUrl,
                headline,
                location: location || 'Not specified',
                about: aboutText,
                experience: experienceStr || '',
                education: educationStr || '',
                services: servicesStr || '',
                email: email || undefined,
                phone: phone || undefined
            };

            setContact(prev => {
                if (!prev || getNormalizedUrl(prev.linkedinUrl) !== getNormalizedUrl(linkedinUrl)) {
                    return currentContact;
                }
                const hasSubstantialNewData = fullName && companyText;
                if (!hasSubstantialNewData && prev.fullName) return prev; // Don't wipe data with empty scan

                // Preserve email/phone if they exist in state or are found in current scan
                return {
                    ...currentContact,
                    email: currentContact.email || prev.email,
                    phone: currentContact.phone || prev.phone,
                    phoneSource: prev.phoneSource,
                    phoneConfidence: prev.phoneConfidence,
                    emailSource: prev.emailSource,
                    emailConfidence: prev.emailConfidence
                };
            });
        } catch (err) {
            console.error("ScrapeData Crash:", err);
        }
    };

    const scrapeContactInfo = async (): Promise<{ emails: string[], email: string, phone: string, links: string[] }> => {
        let email = "Not available";
        let phone = "Not available";
        let links: string[] = [];
        let emails: string[] = [];

        const waitForElement = (selector: string, timeout = 7000): Promise<Element | null> => {
            return new Promise((resolve) => {
                const existing = document.querySelector(selector);
                if (existing) return resolve(existing);
                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) { observer.disconnect(); resolve(el); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
            });
        };

        try {
            // Desperate search for "Contact info" link
            let contactInfoLink = (Array.from(document.querySelectorAll('a, button')).find(el =>
                (el as HTMLElement).innerText?.replace(/\s+/g, ' ').toLowerCase().includes('contact info') ||
                (el as any).href?.includes('contact-info/')
            ) as HTMLElement);

            // Backup selectors if text search fails
            if (!contactInfoLink) {
                contactInfoLink = (document.querySelector('a#top-card-text-details-contact-info') as HTMLElement) ||
                    (document.querySelector('a[href*="/overlay/contact-info/"]') as HTMLElement) ||
                    (document.querySelector('.pv-text-details__left-panel a[href$="contact-info/"]') as HTMLElement) ||
                    (document.querySelector('.pv-text-details__right-panel-item-text') as HTMLElement);
            }

            if (contactInfoLink) {
                console.log("Found contact info link, clicking...");
                contactInfoLink.scrollIntoView({ block: 'center' }); // Ensure it's in view
                await new Promise(r => setTimeout(r, 300));
                contactInfoLink.click();

                const modal = await waitForElement('.artdeco-modal') as HTMLElement;
                if (modal) {
                    console.log("Modal opened, waiting for content...");
                    await new Promise(r => setTimeout(r, 1800)); // Wait for data to load

                    // 1. Fetch all http links except LinkedIn
                    const modalAnchors = modal.querySelectorAll('a[href^="http"]');
                    modalAnchors.forEach(el => {
                        const href = (el as HTMLAnchorElement).href;
                        if (href && !href.includes('linkedin.com') && !links.includes(href)) {
                            links.push(href);
                        }
                    });

                    // 2. Extract Email directly
                    // BROAD SEARCH: scan all text in the modal for any email match
                    const emailRegex = /[a-zA-Z0-9._%+-]+@gmail\.com/gi;
                    const modalText = modal.innerText;
                    const foundEmails = modalText.match(emailRegex);
                    if (foundEmails && foundEmails.length > 0) {
                        emails = [...new Set([...emails, ...foundEmails.map(e => e.toLowerCase())])];
                        email = foundEmails[0].toLowerCase();
                    }

                    const allLinks = Array.from(modal.querySelectorAll('a'));
                    const emailLink = allLinks.find(a => (a as HTMLAnchorElement).href.includes('mailto:') || (a as HTMLElement).innerText.includes('@'));
                    if (emailLink && email === "Not available") {
                        const rawEmail = (emailLink as HTMLElement).innerText.trim() || (emailLink as HTMLAnchorElement).href.replace('mailto:', '').split('?')[0];
                        if (rawEmail && rawEmail.includes('@')) {
                            email = rawEmail;
                            if (!emails.includes(email.toLowerCase())) emails.push(email.toLowerCase());
                        }
                    }

                    // 3. Extract Phone directly
                    const phoneSection = Array.from(modal.querySelectorAll('section')).find(s => (s as HTMLElement).innerText.toLowerCase().includes('phone') || (s as HTMLElement).innerText.toLowerCase().includes('mobile'));
                    if (phoneSection) {
                        const phoneEl = phoneSection.querySelector('span[dir="ltr"]') ||
                            phoneSection.querySelector('li span') ||
                            phoneSection.querySelector('.pv-contact-info__contact-item');
                        phone = phoneEl?.textContent?.trim() || "Not available";
                    }

                    // 4. Extract EVERYTHING that looks like an external website
                    const allModalLinks = modal.querySelectorAll('a');
                    allModalLinks.forEach(a => {
                        const href = (a as HTMLAnchorElement).href;
                        if (href && !href.includes('linkedin.com') && !href.includes('mailto:') && !href.includes('javascript:')) {
                            if (!links.includes(href)) links.push(href);
                        }
                    });

                    const closeBtn = modal.querySelector('.artdeco-modal__dismiss') as HTMLElement ||
                        modal.querySelector('button[aria-label="Dismiss"]') as HTMLElement ||
                        modal.querySelector('svg[data-test-modal-close-btn]')?.parentElement as HTMLElement;
                    if (closeBtn) closeBtn.click();
                }
            } else {
                console.warn("Contact info link still not found. Using fallback page scan.");
            }

            // AUTOMATIC FALLBACK: Scan the main page for visible links anywhere
            const mainPageLinks = document.querySelectorAll('a[href^="http"]');
            mainPageLinks.forEach(el => {
                const href = (el as HTMLAnchorElement).href;
                const blacklist = ['linkedin.com', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'github.com'];
                if (href && !blacklist.some(skip => href.includes(skip)) && !links.includes(href)) {
                    // Heuristic: check if this link is likely a personal site
                    if (href.length < 50 || href.includes('portfolio') || href.includes('apna') || href.includes('me.') || href.includes('.in') || href.includes('.io')) {
                        links.push(href);
                    }
                }
            });
        } catch (e) {
            console.error("Scraper Error:", e);
        }
        return { emails, email, phone, links };
    };

    const enrichData = async (type: 'email' | 'phone') => {
        if (!contact || loadingEnrich) return;
        setLoadingEnrich(true);
        const results = await scrapeContactInfo();

        let finalEmail = results.email;
        let emails = results.emails || [];
        let emailSource = '';
        let emailConfidence: 'high' | 'low' = 'high';

        let finalPhone = results.phone;
        let phoneSource = '';
        let phoneConfidence: 'high' | 'low' = 'high';

        // ALWAYS trigger enrichment if the user specifically requested it by clicking the button
        // especially if the current email is not a personal one (Gmail etc)
        const isPersonalEmail = finalEmail && (finalEmail.includes('gmail.com') || finalEmail.includes('outlook.com') || finalEmail.includes('icloud.com'));

        if (type === 'email' && (!isPersonalEmail || finalEmail === "Not available")) {
            showToast('Searching portfolio & company websites...', 'success');
            const currentLinks = [...results.links];

            // Try to find domain first
            const companyDomain = await findCompanyDomain(contact.company);
            if (companyDomain) {
                const companyUrl = `https://${companyDomain}`;
                if (!currentLinks.some(l => l.includes(companyDomain))) {
                    currentLinks.push(companyUrl);
                }
            }

            // 3. Perform deep enrichment on all links Found
            const enrichment = await performEnrichment('email', currentLinks);
            if (enrichment && enrichment.email) {
                // If multiple emails were found in the deep scan, we could add them here
                // For now, prioritize the best one but keep others if it was a deep fetch
                finalEmail = enrichment.email;
                emailSource = enrichment.source;
                emailConfidence = enrichment.confidence;

                // If we want to capture all emails from enrichment result (need to update EnrichmentResult too)
                if ((enrichment as any).allEmails) {
                    emails = [...new Set([...emails, ...(enrichment as any).allEmails])];
                } else if (!emails.includes(finalEmail)) {
                    emails.push(finalEmail);
                }
            } else if (companyDomain) {
                // FALLBACK: Pattern Generator + SMTP Verifier
                showToast('Attempting Pattern-based SMTP verification...', 'success');
                try {
                    const { first, last } = getFirstLastName(contact.fullName);
                    const patterns = generateEmailPatterns(first, last, companyDomain);
                    const verifyResults = await verifyEmailsBatch(patterns);

                    // Find first valid or unknown
                    const best = verifyResults.find(r => r.status === 'valid') || verifyResults.find(r => r.status === 'unknown');
                    if (best) {
                        finalEmail = best.email;
                        emailSource = 'Pattern+SMTP';
                        emailConfidence = best.status === 'valid' ? 'high' : 'low';
                        setSmtpOffline(false);
                    }
                } catch (e) {
                    if ((e as Error).message === 'SMTP_OFFLINE') {
                        setSmtpOffline(true);
                    }
                }
            }
        }

        if (type === 'phone' && (finalPhone === "Not available" || !finalPhone)) {
            showToast('Searching portfolio & company websites...', 'success');

            // 1. Get initial links from modal/page
            const currentLinks = [...results.links];

            // 2. Proactively find company domain
            const companyDomain = await findCompanyDomain(contact.company);
            if (companyDomain) {
                const companyUrl = `https://${companyDomain}`;
                if (!currentLinks.some(l => l.includes(companyDomain))) {
                    currentLinks.push(companyUrl);
                }
            }

            const enrichment = await performEnrichment('phone', currentLinks);
            if (enrichment && enrichment.phone) {
                finalPhone = enrichment.phone;
                phoneSource = enrichment.source; // Use URL as source
                phoneConfidence = enrichment.confidence;
            }
        }

        const isEmailResult = type === 'email';
        const resultUrl = isEmailResult ? (finalEmail !== results.email ? (emailSource.startsWith('http') ? emailSource : '') : '') : (finalPhone !== results.phone ? (phoneSource.startsWith('http') ? phoneSource : '') : '');

        setContact(prev => {
            if (!prev) return null;
            return {
                ...prev,
                email: type === 'email' ? (finalEmail !== "Not available" ? finalEmail : (prev.email || "Not available")) : prev.email,
                emails: type === 'email' ? (emails.length > 0 ? emails : prev.emails) : prev.emails,
                phone: type === 'phone' ? (finalPhone !== "Not available" ? finalPhone : (prev.phone || "Not available")) : prev.phone,
                phoneSource: type === 'phone' ? (phoneSource || prev.phoneSource) : prev.phoneSource,
                phoneSourceUrl: type === 'phone' ? (resultUrl || prev.phoneSourceUrl) : prev.phoneSourceUrl,
                phoneConfidence: type === 'phone' ? (phoneConfidence || prev.phoneConfidence) : prev.phoneConfidence,
                emailSource: type === 'email' ? (emailSource || prev.emailSource) : prev.emailSource,
                emailSourceUrl: type === 'email' ? (resultUrl || prev.emailSourceUrl) : prev.emailSourceUrl,
                emailConfidence: type === 'email' ? (emailConfidence || prev.emailConfidence) : prev.emailConfidence
            };
        });

        const found = type === 'email' ? finalEmail !== "Not available" : finalPhone !== "Not available";
        const currentSource = type === 'email' ? emailSource : phoneSource;

        if (found) {
            showToast(`${type === 'email' ? 'Email' : 'Phone'} Scraped! ${currentSource ? 'via ' + currentSource : ''}`, 'success');
        } else {
            showToast(`${type === 'email' ? 'Email' : 'Phone'} not found`, 'error');
        }
        setLoadingEnrich(false);
    };

    const saveToDashboard = async (e?: React.MouseEvent | React.FormEvent, listToUse: string = 'General') => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!contact) return;

        try {
            const currentUrl = getNormalizedUrl(contact.linkedinUrl);
            const newContact = {
                id: Math.random().toString(36).substr(2, 9),
                linkedin_url: currentUrl,
                full_name: contact.fullName,
                job_title: contact.jobTitle || 'No Title',
                company: contact.company || 'Unknown',
                profile_photo_url: contact.profilePhoto,
                headline: contact.headline,
                location: contact.location,
                about: contact.about || 'No description available',
                experience: contact.experience,
                education: contact.education,
                services: contact.services,
                email: contact.email || 'Not available on LinkedIn',
                phone: contact.phone || 'Not available on LinkedIn',
                email_source: contact.emailSource || '',
                phone_source: contact.phoneSource || '',
                list_name: listToUse,
                date_added: new Date().toISOString(),
                lists: [{ name: listToUse }]
            };

            chrome.storage.local.get(['contacts'], (result) => {
                const existingContacts = result.contacts || [];
                // More aggressive normalization for filtering
                const filtered = existingContacts.filter((c: any) => {
                    const existingUrl = getNormalizedUrl(c.linkedin_url || '');
                    return existingUrl !== currentUrl && c.full_name !== contact.fullName;
                });

                const updatedContacts = [...filtered, newContact];
                chrome.storage.local.set({ contacts: updatedContacts }, () => {
                    showToast(`Contact Saved!`, 'success');
                    setIsSaved(true);
                    setShowAddListInput(false);

                    // Force broadcast sync to all tabs (dashboard will pick it up)
                    window.postMessage({ type: 'SYNC_FROM_EXTENSION', data: updatedContacts }, '*');
                    chrome.runtime.sendMessage({ action: 'FORCE_DASHBOARD_SYNC', data: updatedContacts });
                });
            });
        } catch (e) {
            showToast('Something went wrong!', 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        scrapeData();
        const interval = setInterval(scrapeData, 2000);
        return () => clearInterval(interval);
    }, [contact?.linkedinUrl]); // Only re-run interval if URL changes

    useEffect(() => {
        if (isVisible) document.body.style.marginRight = '340px';
        else document.body.style.marginRight = '0';
    }, [isVisible]);

    useEffect(() => {
        const isDashboard = window.location.host.includes('localhost:3000') || window.location.host.includes('127.0.0.1:3000');
        if (isDashboard) {
            const syncToDashboard = () => {
                chrome.storage.local.get(['contacts'], (result) => {
                    console.log('Force Syncing Dashboard:', result.contacts);
                    window.postMessage({ type: 'SYNC_FROM_EXTENSION', data: result.contacts || [] }, '*');
                });
            };

            syncToDashboard(); // Initial sync

            // Sync on window focus to catch any changes while tab was in background
            window.addEventListener('focus', syncToDashboard);

            // Sync on storage changes from other tabs
            const storageListener = (changes: any) => {
                if (changes.contacts) syncToDashboard();
            };
            chrome.storage.onChanged.addListener(storageListener);

            // Sync on direct messages from background script
            const messageSyncListener = (message: any) => {
                if (message.action === 'SYNC_FROM_EXTENSION') {
                    window.postMessage({ type: 'SYNC_FROM_EXTENSION', data: message.data }, '*');
                }
            };
            chrome.runtime.onMessage.addListener(messageSyncListener);

            return () => {
                window.removeEventListener('focus', syncToDashboard);
                chrome.storage.onChanged.removeListener(storageListener);
                chrome.runtime.onMessage.removeListener(messageSyncListener);
            };
        }
    }, []);

    // ✱ AUTO-TRIGGER ENRICHMENT ON MODAL OPEN ✱
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    const modal = document.querySelector('.artdeco-modal');
                    if (modal && !loadingEnrich) {
                        const modalText = (modal as HTMLElement).innerText.toLowerCase();
                        if (modalText.includes('contact info') || modalText.includes('apnacollege')) {
                            console.log("✱ Auto-Triggering Enrichment from Modal ✱");
                            enrichData('email');
                            enrichData('phone');
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [contact, loadingEnrich]);

    return (
        <>
            {!isVisible && (
                <div onClick={() => setIsVisible(true)} style={{ position: 'fixed', right: '0', top: '150px', width: '44px', height: '48px', background: '#EDF118', borderRadius: '8px 0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 2147483646 }}>
                    <span style={{ fontSize: '30px', color: '#111' }}>✱</span>
                </div>
            )}

            <div style={{ position: 'fixed', right: isVisible ? '0' : '-340px', top: 0, width: '340px', height: '100vh', background: '#FDFDFD', color: '#111', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', zIndex: 2147483647, transition: 'right 0.3s ease-in-out', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E2E8F0', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18, color: '#111' }}>✱</span>
                        <span style={{ fontWeight: '700', fontSize: 16, color: '#111' }}>Sales Intel</span>
                    </div>
                    <span style={{ opacity: 0.8, fontSize: '24px', cursor: 'pointer', color: '#555' }} onClick={() => setIsVisible(false)}>×</span>
                </div>

                <div style={{ padding: '8px 16px', display: 'flex', background: '#fff' }}>
                    <button onClick={() => setActiveTab('Person')} style={{ flex: 1, padding: '10px', background: activeTab === 'Person' ? '#444' : '#fff', color: activeTab === 'Person' ? '#fff' : '#555', border: '1px solid #E5E7EB', borderRadius: '6px 0 0 6px', fontSize: 13, fontWeight: '600' }}>👤 Person</button>
                    <button onClick={() => setActiveTab('Company')} style={{ flex: 1, padding: '10px', background: activeTab === 'Company' ? '#444' : '#fff', color: activeTab === 'Company' ? '#fff' : '#555', border: '1px solid #E5E7EB', borderRadius: '0 6px 6px 0', fontSize: 13, fontWeight: '600' }}>🏢 Company</button>
                </div>

                <div style={{ padding: '24px 16px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: 12, textAlign: 'center' }}>
                        <h2 style={{ fontSize: 22, fontWeight: '800', margin: '0', color: '#111' }}>{contact?.fullName || 'Scanning...'}</h2>
                    </div>

                    {contact && (
                        <div style={{ marginBottom: 20, padding: '12px', background: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD', fontSize: '11px' }}>
                            <div style={{ fontWeight: '800', color: '#0369A1', marginBottom: 6 }}>PROFILE INSIGHTS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><span style={{ fontWeight: '700' }}>Company:</span> {contact.company}</div>
                                {contact.about && <div><span style={{ fontWeight: '700' }}>About:</span> {contact.about.length > 100 ? contact.about.substring(0, 100) + '...' : contact.about}</div>}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                        <button onClick={(e) => saveToDashboard(e)} style={{ flex: 1, padding: '12px', background: isSaved ? '#10b981' : '#EDF118', color: '#111', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '12px' }}>{isSaved ? '✓ SAVED' : 'SAVE CONTACT'}</button>
                        <button onClick={() => setShowAddListInput(!showAddListInput)} style={{ flex: 1, padding: '12px', background: '#F3F4F6', color: '#111', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: '800', fontSize: '12px' }}>ADD TO LIST</button>
                    </div>

                    {showAddListInput && (
                        <div style={{ marginBottom: 24, padding: 14, background: '#F9FAFB', borderRadius: 14, border: '1px solid #E5E7EB' }}>
                            <input type="text" placeholder="List Name" value={listName} onChange={(e) => setListName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: 10 }} />
                            <button onClick={(e) => saveToDashboard(e, listName)} style={{ width: '100%', padding: '10px', background: '#111', color: '#fff', borderRadius: '8px' }}>Done</button>
                        </div>
                    )}

                    <h3 style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Contact information</h3>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', margin: 0 }}>Email</p>
                            {smtpOffline && <span style={{ fontSize: '9px', background: '#FEE2E2', color: '#B91C1C', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>SMTP OFFLINE</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {contact?.emails && contact.emails.length > 0 ? (
                                contact.emails.map((e, idx) => (
                                    <div key={idx} style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700', position: 'relative', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(e); showToast('Email Copied!', 'success'); }}>
                                        {e}
                                        <div style={{ fontSize: '9px', color: '#0369A1', marginTop: '4px', fontWeight: '400' }}>
                                            Click to copy
                                        </div>
                                    </div>
                                ))
                            ) : contact?.email && contact.email !== 'Not available' && contact.email !== 'Not available on LinkedIn' ? (
                                <div style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700', position: 'relative', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(contact.email!); showToast('Email Copied!', 'success'); }}>
                                    {contact.email}{contact.emailConfidence === 'low' ? '?' : ''}
                                    {contact.emailSource === 'Pattern+SMTP' && <span style={{ marginLeft: '8px', fontSize: '9px', background: contact.emailConfidence === 'high' ? '#DCFCE7' : '#FEF9C3', color: contact.emailConfidence === 'high' ? '#166534' : '#854d0e', padding: '2px 6px', borderRadius: '4px' }}>{contact.emailConfidence === 'high' ? 'VALID' : 'PROBABLE'}</span>}
                                    {contact.emailSource && (
                                        <div style={{ fontSize: '9px', color: '#0369A1', marginTop: '4px', fontWeight: '400' }}>
                                            via {contact.emailSource.startsWith('http') ? (
                                                <a href={contact.emailSource} target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
                                                    {new URL(contact.emailSource).hostname}
                                                </a>
                                            ) : contact.emailSource}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button onClick={() => enrichData('email')} disabled={loadingEnrich} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{loadingEnrich ? 'Searching...' : 'Gmail Access'}</button>
                            )}
                        </div>
                    </div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', marginBottom: 8 }}>Phone numbers</p>
                        {contact?.phone && contact.phone !== 'Not available' && contact.phone !== 'Not available on LinkedIn' ? (
                            <div style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700' }}>
                                {contact.phone}{contact.phoneConfidence === 'low' ? '?' : ''}
                                {contact.phoneSource && (
                                    <div style={{ fontSize: '9px', color: '#0369A1', marginTop: '4px', fontWeight: '400' }}>
                                        via {contact.phoneSource.startsWith('http') ? (
                                            <a href={contact.phoneSource} target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1', textDecoration: 'underline' }}>
                                                {new URL(contact.phoneSource).hostname}
                                            </a>
                                        ) : contact.phoneSource}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => enrichData('phone')} disabled={loadingEnrich} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', fontWeight: '800' }}>{loadingEnrich ? 'Searching...' : 'Access Phone'}</button>
                        )}
                    </div>
                </div>

                {toast && (
                    <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16, padding: '12px', background: toast.type === 'success' ? '#111' : '#ef4444', color: '#fff', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', zIndex: 10000 }}>
                        {toast.message}
                    </div>
                )}
            </div>
        </>
    );
};

const rootContainer = document.createElement('div');
rootContainer.id = 'sales-intel-root';
document.body.appendChild(rootContainer);
const rootElement = createRoot(rootContainer);
rootElement.render(<Sidebar />);
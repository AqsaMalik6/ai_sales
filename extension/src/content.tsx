import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { performEnrichment, rapidApiContactSearch } from './enrichment';
import { generateEmailPatterns, findCompanyDomain, getFirstLastName } from './emailPatternGenerator';

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
                    const text = el.textContent.trim().split(/\s+·\s+/)[0];
                    if (text && text.toLowerCase() !== 'contact info' && text.length < 100 && text.length > 2 && !text.includes('LinkedIn')) {
                        fullName = text;
                        break;
                    }
                }
            }

            if (!fullName && document.title && document.title.includes('|')) {
                const titleName = document.title.split('|')[0].trim();
                if (titleName && !titleName.includes('LinkedIn')) fullName = titleName;
            }

            const jobTitle = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
                document.querySelector('.pv-text-details__left-panel .text-body-medium')?.textContent?.trim() ||
                document.querySelector('.text-body-medium')?.textContent?.trim() || '';

            const headline = jobTitle;
            let currentJobTitle = headline;
            let companyText = '';

            // PRIORITY 1: HTML RAW STRING SCAN (Absolute 100% Guarantee if localized)
            const htmlRaw = document.documentElement.innerHTML;
            // Support "Current company:" or just standard labeled attributes
            const ariaMatch = htmlRaw.match(/aria-label="(?:Current company|Current university|Education):\s*([^"]+?)(?:\.\s*Click|")/i);
            if (ariaMatch && ariaMatch[1]) {
                companyText = ariaMatch[1].trim();
            }

            // Anchor strictly to the h1 container to avoid finding unrelated sections
            const h1 = document.querySelector('h1.text-heading-xlarge, h1');
            const topCard = h1 ? (h1.closest('section') || h1.closest('.ph5') || document.querySelector('.pv-top-card')) || document.body : document.body;

            // PRIORITY 2: TOP CARD LOGO ALT TEXT
            if (!companyText) {
                // Focus strictly on links/buttons in topCard
                const logos = topCard.querySelectorAll('a img, button img, .pv-text-details__right-panel-item-link img');
                for (const img of Array.from(logos)) {
                    if ((img.className || "").match(/profile-picture|background|cover|premium|ghost/i)) continue;
                    let alt = img.getAttribute('alt')?.trim() || "";

                    // Deep cleanup of noise
                    alt = alt.replace(/^(?:View|Visit|Website)\s+/i, '').replace(/\s+logo$/i, '').replace(/(?:Current )?Company:\s*/i, '').trim();

                    if (alt && alt.length > 1 && !alt.match(/profile|avatar|background|cover image|cover photo|banner|premium|image|photo|picture|celebration/i)) {
                        companyText = alt;
                        break;
                    }
                }
            }

            // PRIORITY 3: RIGHT PANEL TEXT ELIMINATION
            if (!companyText) {
                const rightPanel = topCard.querySelector('.pv-text-details__right-panel, ul.pv-top-card--experience-list, .pv-text-details__right-panel-item-list');
                const searchArea = rightPanel || topCard;
                const buttons = Array.from(searchArea.querySelectorAll('a, button, li'));

                for (const btn of buttons) {
                    // If searching whole topCard, require an image to avoid generic buttons
                    if (!rightPanel && !btn.querySelector('img')) continue;

                    // Block Profile/Banner buttons
                    if ((btn.className || "").match(/profile|cover|banner|background/i)) continue;

                    let aria = btn.getAttribute('aria-label') || "";
                    let activeText = aria || (btn as HTMLElement).innerText || btn.textContent || "";
                    activeText = activeText.split('\n').map(t => t.trim()).find(t => t.length > 1) || "";

                    // Strip 'View', 'Current Company', etc to isolate just the name
                    activeText = activeText.replace(/(?:Current company|Current university|Education):\s*/ig, '').replace(/Click to skip.*/ig, '')
                        .replace(/^(?:View|Visit|Website)\s+/i, '').replace(/\.$/, '').trim();

                    if (activeText.length > 1 && !activeText.match(/followers?|connections?|mutual|shared|contact|message|profile|premium|more|follow|connect|send|image|photo|picture|celebration/i) && !activeText.includes('http') && !activeText.includes('www.')) {
                        companyText = activeText; break;
                    }
                }
            }

            // PRIORITY 4: EXPERIENCE SECTION (ChatGPT Inspired, Noise-Free)
            if (!companyText) {
                const expHeadline = document.getElementById('experience') || document.querySelector('#experience-section') || Array.from(document.querySelectorAll('h2')).find(h2 => h2.textContent?.toLowerCase().includes('experience'));
                const expSec = expHeadline?.closest('section') || document.querySelector('#experience-section');

                if (expSec) {
                    const firstItem = expSec.querySelector('.pvs-list > li, li.artdeco-list__item, li.experience-item');
                    if (firstItem) {
                        // Strictly extract ONLY the core titles/companies to avoid locations as "noise"
                        const textNodes = Array.from(firstItem.querySelectorAll('.t-bold span[aria-hidden="true"], .t-normal span[aria-hidden="true"], .t-14 span[aria-hidden="true"]'))
                            .map(el => el.textContent?.trim() || "")
                            .filter(t => t.length > 1 && !t.includes('Present') && !t.match(/yrs?|mos?|Full-time|Part-time|Self-employed|Freelance|Contract|Internship|Apprenticeship|Remote|On-site|Hybrid/i));

                        // Deduplicate 
                        const uniqueTexts = [...new Set(textNodes)];
                        const isMultipleRoleGroup = firstItem.querySelector('.pvs-entity--with-path');

                        if (uniqueTexts.length >= 2) {
                            companyText = (isMultipleRoleGroup ? uniqueTexts[0] : uniqueTexts[1]).split(/\s+·\s+/)[0];
                        } else if (uniqueTexts.length === 1) {
                            companyText = uniqueTexts[0].split(/\s+·\s+/)[0];
                        }
                    }
                }
            }

            // PRIORITY 5: DESPERATE COMPANY SEARCH
            if (!companyText) {
                const desperatelyFind = document.querySelector('a[data-field="experience_company_logo"], a[href*="/company/"]');
                if (desperatelyFind) {
                    const aria = desperatelyFind.getAttribute('aria-label') || "";
                    const match = aria.match(/(?:company|university):\s*([^.]+)/i);
                    if (match && match[1]) {
                        companyText = match[1].trim();
                    } else {
                        let text = desperatelyFind.textContent?.trim() || "";
                        if (text) companyText = text.replace(/logo/i, '').trim();
                    }
                }
            }

            // PRIORITY 6: HEADLINE FALLBACK (Infallible Text-level backup)
            if (!companyText && headline) {
                if (headline.toLowerCase().includes(' at ')) {
                    const parts = headline.split(/\s+at\s+/i);
                    if (parts.length > 1) {
                        companyText = parts[parts.length - 1].split('|')[0].trim();
                    }
                }
            }

            // PRIORITY 3: Education Section Safe Fallback
            if (!companyText) {
                const eduSec = document.getElementById('education')?.closest('section') || Array.from(document.querySelectorAll('section')).find(s => s.querySelector('h2')?.textContent?.toLowerCase().includes('education'));
                if (eduSec) {
                    const firstEdu = eduSec.querySelector('.pvs-list > li, li.artdeco-list__item');
                    if (firstEdu) {
                        const eduTexts = Array.from(firstEdu.querySelectorAll('span[aria-hidden="true"]'))
                            .map(el => el.textContent?.trim() || "")
                            .filter(t => t.length > 1 && !t.match(/grade|activities|societies/i));
                        if (eduTexts.length > 0) companyText = eduTexts[0];
                    }
                }
            }

            // HIGHLY ROBUST LOCATION DISCOVERY
            let extractedLocation = "";
            const contactInfoBtn = Array.from(document.querySelectorAll('a')).find(el => el.textContent?.toLowerCase().includes('contact info'));

            if (contactInfoBtn) {
                const container = contactInfoBtn.closest('.pv-text-details__left-panel') || contactInfoBtn.parentElement?.parentElement;
                if (container) {
                    const spans = Array.from(container.querySelectorAll('span.text-body-small'));
                    for (const span of spans) {
                        const t = span.textContent?.trim() || "";
                        if (t.length > 2 && !t.match(/follower|connection|contact/i) && !span.querySelector('a')) {
                            extractedLocation = t.split(/\n/)[0].trim().replace(/\s*·\s*$/, '').trim();
                            break;
                        }
                    }
                    if (!extractedLocation) {
                        const rawText = container.textContent || "";
                        const beforeContact = rawText.split(/contact info/i)[0];
                        const lines = beforeContact.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        if (lines.length > 0) {
                            const lastLine = lines[lines.length - 1];
                            if (!lastLine.match(/follower|connection/i)) {
                                extractedLocation = lastLine.replace(/^[\s·]+|[\s·]+$/g, '').trim();
                            }
                        }
                    }
                }
            }

            if (!extractedLocation) {
                const locSelectors = [
                    '.pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words',
                    '.pv-text-details__left-panel span.text-body-small.inline',
                    '.text-body-small.inline.t-black--light.break-words',
                    '.ph5 .mt2 span.text-body-small'
                ];
                for (const sel of locSelectors) {
                    const elements = document.querySelectorAll(sel);
                    for (const el of Array.from(elements)) {
                        const t = el.textContent?.trim() || "";
                        if (t.length > 2 && !t.match(/follower|connection|contact/i)) {
                            extractedLocation = t.split(/\n/)[0].trim().replace(/^[\s·]+|[\s·]+$/g, '').trim();
                            break;
                        }
                    }
                    if (extractedLocation) break;
                }
            }

            const location = extractedLocation || "Not specified";

            // ROBUST ABOUT DISCOVERY
            let aboutText = '';
            const allSections = Array.from(document.querySelectorAll('section'));
            let aboutSection = allSections.find(s => {
                const h2 = s.querySelector('h2');
                return h2 && h2.textContent?.trim().toLowerCase().includes('about');
            }) || document.getElementById('about')?.closest('section');

            if (aboutSection) {
                const contentSelector = '.inline-show-more-text, .pv-shared-text-with-see-more, .pv-about-section__summary-text';
                const el = aboutSection.querySelector(contentSelector);
                if (el) {
                    aboutText = el.textContent?.trim().replace(/\s+/g, ' ') || "";
                } else {
                    const clone = aboutSection.cloneNode(true) as HTMLElement;
                    clone.querySelector('h2')?.remove();
                    clone.querySelector('button')?.remove();
                    aboutText = clone.innerText.trim().replace(/\s+/g, ' ');
                }
            }

            const pageText = document.body.innerText;
            const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@gmail\.com|@outlook\.com|@icloud\.com/gi;
            const PHONE_REGEX = /(?:\+?\d{1,3}[\s\. -])?\(?\d{2,4}\)?[\s\. -]?\d{3,4}[\s\. -]?\d{3,6}/g;

            const experienceStr = Array.from(document.querySelectorAll('#experience ~ div .pvs-entity')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');
            const educationStr = Array.from(document.querySelectorAll('#education ~ div .pvs-entity')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');

            let email = '';
            let phone = '';

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
                profilePhoto: '', // Disabled Profile Photo Capture Completely
                linkedinUrl: window.location.href,
                headline,
                location: location || 'Not specified',
                about: aboutText,
                experience: experienceStr || '',
                education: educationStr || '',
                services: '',
                email: email || undefined,
                phone: phone || undefined
            };

            setContact(prev => {
                const currentHref = window.location.href;
                if (!currentHref.includes('/in/')) return prev; // Do not wipe outside of profile pages

                const isNewProfile = !prev || getNormalizedUrl(prev.linkedinUrl) !== getNormalizedUrl(currentHref);

                // If it is a new profile link, aggressively reset the state to avoid 'pichli profile ka data'
                if (isNewProfile) {
                    if (!fullName) {
                        return { fullName: 'Scanning...', jobTitle: '', company: 'Scanning...', headline: '', location: 'Scanning...', about: '', experience: '', education: '', services: '', linkedinUrl: currentHref, profilePhoto: '' };
                    }
                    return currentContact; // Fresh setup
                }

                // If we are on the exact same profile but DOM is empty (e.g. while scrolling/loading)
                if (!fullName) return prev;

                // If the DOM name violently changed while on the same URL (DOM catch-up phase)
                if (prev.fullName !== 'Scanning...' && prev.fullName !== fullName) {
                    return currentContact; // Treat it as a hard reset to the new data
                }

                return {
                    ...currentContact,
                    // Persist discovered data, never fallback to "Scanning..." or old profile data
                    company: currentContact.company !== 'No Company Data' ? currentContact.company : prev.company,
                    location: currentContact.location !== 'Not specified' ? currentContact.location : prev.location,
                    about: currentContact.about || prev.about,
                    email: currentContact.email || prev.email,
                    phone: currentContact.phone || prev.phone,
                    emails: prev.emails,
                    emailSource: prev.emailSource,
                    phoneSource: prev.phoneSource,
                    emailConfidence: prev.emailConfidence,
                    phoneConfidence: prev.phoneConfidence,
                    profilePhoto: ''
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
                    const emailRegex = /[a-zA-Z0-9._%+-]+@gmail\.com|@outlook\.com|@icloud\.com/gi;
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

    const scanActivity = (): { email?: string, phone?: string } => {
        try {
            console.log("Scanning activity section for contacts...");
            const activitySection = Array.from(document.querySelectorAll('section')).find(s =>
                s.querySelector('h2')?.textContent?.toLowerCase().includes('activity')
            ) || document.querySelector('.pv-activity-section');

            if (!activitySection) {
                console.warn("Activity section not found on page.");
                return {};
            }

            const text = (activitySection as HTMLElement).innerText;
            const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@gmail\.com|@outlook\.com|@icloud\.com/gi;
            const PHONE_REGEX = /(?:\+?\d{1,3}[\s\. -])?\(?\d{2,4}\)?[\s\. -]?\d{3,4}[\s\. -]?\d{3,6}/g;

            const email = text.match(EMAIL_REGEX)?.[0];
            const phone = text.match(PHONE_REGEX)?.find(p => p.replace(/\D/g, '').length >= 10);

            return { email, phone };
        } catch (e) {
            console.error("Activity Scan Error:", e);
            return {};
        }
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

        const isPersonalEmail = finalEmail && (finalEmail.includes('gmail.com') || finalEmail.includes('outlook.com') || finalEmail.includes('icloud.com'));

        // FALLBACK CASCADE FOR EMAIL
        if (type === 'email' && (finalEmail === "Not available" || !isPersonalEmail)) {
            showToast('Searching for verified email...', 'success');

            // 1. Website Enrichment
            const currentLinks = [...results.links];
            const enrichment = await performEnrichment('email', currentLinks);
            if (enrichment && enrichment.email) {
                finalEmail = enrichment.email;
                emailSource = enrichment.source;
                emailConfidence = enrichment.confidence;
                if ((enrichment as any).allEmails) {
                    emails = [...new Set([...emails, ...(enrichment as any).allEmails])];
                } else if (!emails.includes(finalEmail)) {
                    emails.push(finalEmail);
                }
            }

            // 2. Activity/Posts Scan
            if (finalEmail === "Not available" || !finalEmail) {
                const act = scanActivity();
                if (act.email) {
                    finalEmail = act.email;
                    emailSource = 'Activity Feed Scan';
                    emailConfidence = 'high';
                    if (!emails.includes(finalEmail)) emails.push(finalEmail);
                }
            }

            // 3. Deep Page Scan
            if (finalEmail === "Not available" || !finalEmail) {
                const deepText = document.body.innerText;
                const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@gmail\.com|@outlook\.com|@icloud\.com/gi;
                const found = deepText.match(EMAIL_REGEX);
                if (found && found.length > 0) {
                    finalEmail = found[0].toLowerCase();
                    emailSource = 'Intelligence Scan';
                    emailConfidence = 'high';
                }
            }
        }

        // PHONE FALLBACK CASCADE
        if (type === 'phone' && (finalPhone === "Not available" || !finalPhone)) {
            showToast('Searching for contact number...', 'success');

            // 1. Activity Scan
            const act = scanActivity();
            if (act.phone) {
                finalPhone = act.phone;
                phoneSource = 'Activity Feed Scan';
                phoneConfidence = 'high';
            }

            // 2. Website Scan
            if (finalPhone === "Not available") {
                const currentLinks = [...results.links];
                const enrichment = await performEnrichment('phone', currentLinks);
                if (enrichment && enrichment.phone) {
                    finalPhone = enrichment.phone;
                    phoneSource = enrichment.source;
                    phoneConfidence = enrichment.confidence;
                }
            }

            // 3. Page Scan
            if (finalPhone === "Not available") {
                const PHONE_REGEX = /(?:\+?\d{1,3}[\s\. -])?\(?\d{2,4}\)?[\s\. -]?\d{3,4}[\s\. -]?\d{3,6}/g;
                const matches = document.body.innerText.match(PHONE_REGEX);
                if (matches) {
                    const valid = matches.find(p => p.replace(/\D/g, '').length >= 10);
                    if (valid) {
                        finalPhone = valid;
                        phoneSource = 'Intelligence Scan';
                    }
                }
            }
        }

        setContact(prev => {
            if (!prev) return null;
            const updatedEmail = (finalEmail && finalEmail !== 'Not available') ? finalEmail : prev.email;
            const updatedPhone = (finalPhone && finalPhone !== 'Not available') ? finalPhone : prev.phone;
            return {
                ...prev,
                email: updatedEmail,
                emails: emails.length > 0 ? emails : prev.emails,
                phone: updatedPhone,
                emailSource: emailSource || prev.emailSource,
                emailConfidence: emailConfidence || prev.emailConfidence,
                phoneSource: phoneSource || prev.phoneSource,
                phoneConfidence: phoneConfidence || prev.phoneConfidence
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
        const interval = setInterval(scrapeData, 1000);

        const mainObserver = new MutationObserver(() => scrapeData());
        const mainNode = document.querySelector('main.scaffold-layout__main') || document.body;
        mainObserver.observe(mainNode, { childList: true, subtree: true });

        return () => {
            clearInterval(interval);
            mainObserver.disconnect();
        };
    }, [contact?.linkedinUrl]);

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

    // ✱ DUPLICATE DETECTION LOGIC ✱
    useEffect(() => {
        if (!contact?.linkedinUrl || contact.fullName === 'Scanning...') {
            setIsSaved(false);
            return;
        }

        const checkSavedStatus = () => {
            const currentUrl = getNormalizedUrl(contact.linkedinUrl);
            chrome.storage.local.get(['contacts'], (result) => {
                const existingContacts = result.contacts || [];
                const isDuplicate = existingContacts.some((c: any) => {
                    const existingUrl = getNormalizedUrl(c.linkedin_url || '');
                    return existingUrl === currentUrl || (c.full_name === contact.fullName && contact.fullName !== 'Scanning...');
                });
                setIsSaved(isDuplicate);
            });
        };

        checkSavedStatus();
        const storageListener = (changes: any) => { if (changes.contacts) checkSavedStatus(); };
        chrome.storage.onChanged.addListener(storageListener);
        return () => chrome.storage.onChanged.removeListener(storageListener);
    }, [contact?.linkedinUrl, contact?.fullName]);


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
                        {isSaved && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#DCFCE7', color: '#166534', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', marginBottom: '14px', border: '1px solid #BBF7D0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ marginRight: '6px' }}>✓</span> Already Saved
                            </div>
                        )}
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
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', margin: 0 }}>Email</p>
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
                    <div style={{ marginTop: 20 }}>
                        <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 }}>Phone numbers</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {contact?.phone && contact.phone !== 'Not available' && contact.phone !== 'Not available on LinkedIn' ? (
                                <div style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700' }}>
                                    {contact.phone}{contact.phoneConfidence === 'low' ? '?' : ''}
                                    {contact.phoneSource && (
                                        <div style={{ fontSize: '9px', color: '#0369A1', marginTop: '4px', fontWeight: '400' }}>
                                            via {contact.phoneSource.startsWith('http') ? (
                                                <a href={contact.phoneSource} target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1', textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); }}>
                                                    {new URL(contact.phoneSource).hostname}
                                                </a>
                                            ) : contact.phoneSource}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button onClick={() => enrichData('phone')} disabled={loadingEnrich} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{loadingEnrich ? 'Searching...' : 'Access Phone'}</button>
                            )}
                        </div>
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

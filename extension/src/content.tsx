import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
    phone?: string;
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

    useEffect(() => {
        const messageListener = (message: any) => {
            if (message.action === 'TOGGLE_SIDEBAR') {
                setIsVisible(prev => !prev);
            }
        };
        
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(messageListener);
            return () => chrome.runtime.onMessage.removeListener(messageListener);
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
        const nameSelectors = ['h1.text-heading-xlarge', '.pv-text-details__left-panel h1', '.text-heading-xlarge', 'h1'];
        let fullName = '';
        for (const selector of nameSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent?.trim()) {
                const text = el.textContent.trim();
                if (text && text.toLowerCase() !== 'contact info') {
                    fullName = text;
                    break;
                }
            }
        }

        const jobTitle = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
            document.querySelector('.pv-text-details__left-panel .text-body-medium')?.textContent?.trim() || 
            document.querySelector('.text-body-medium')?.textContent?.trim() || '';

        const headline = jobTitle;
        let companyText = '';
        const companySelectors = ['.pv-text-details__right-panel-item-text', 'button[data-field="experience_company_logo"] span', '.pv-entity__secondary-title', '.pvs-list__outer-container .pvs-entity span[aria-hidden="true"]'];

        for (const selector of companySelectors) {
            const els = document.querySelectorAll(selector);
            for (const el of Array.from(els)) {
                if (el && el.textContent?.trim()) {
                    const text = el.textContent.trim();
                    const isEducation = el.closest('#education') || el.closest('section:has(#education)') || text.toLowerCase().includes('university') || text.toLowerCase().includes('college');
                    if (!isEducation && text.length < 100 && text.length > 2 && !text.includes('·')) {
                        companyText = text;
                        break;
                    } else if (!isEducation && text.includes('·')) {
                        companyText = text.split('·')[0].trim();
                        break;
                    }
                }
            }
            if (companyText) break;
        }

        if (!companyText) {
            const expSection = document.querySelector('#experience')?.closest('section');
            if (expSection) {
                const entry = expSection.querySelector('.display-flex.flex-column.full-width');
                if (entry) {
                    const spans = entry.querySelectorAll('span[aria-hidden="true"]');
                    if (spans.length >= 2) companyText = spans[1].textContent?.trim().split('·')[0].trim() || '';
                }
            }
        }

        const profilePhoto = (document.querySelector('.pv-top-card-profile-picture__image') as HTMLImageElement)?.src || '';
        const linkedinUrl = getNormalizedUrl(window.location.href);
        const location = document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() || '';

        const aboutSelectors = ['#about ~ div.display-flex span[aria-hidden="true"]', '#about ~ div span[aria-hidden="true"]', 'section.pv-about-section span'];
        let aboutText = '';
        for (const sel of aboutSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent?.trim()) {
                aboutText = el.textContent.trim().replace(/\n/g, ' ');
                break;
            }
        }

        const experienceStr = Array.from(document.querySelectorAll('#experience ~ div .pvs-entity')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');
        const educationStr = Array.from(document.querySelectorAll('#education ~ div .pvs-entity')).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean).join('\n---\n');
        const servicesStr = document.querySelector('.pv-top-card--services')?.textContent?.trim() || '';

        const currentContact: ContactData = { fullName, jobTitle, company: companyText || 'No Company Data', profilePhoto, linkedinUrl, headline, location, about: aboutText, experience: experienceStr, education: educationStr, services: servicesStr };

        setContact(prev => {
            if (!prev || getNormalizedUrl(prev.linkedinUrl) !== getNormalizedUrl(linkedinUrl)) {
                return currentContact;
            }
            // Preserve email/phone if they exist in state
            return {
                ...currentContact,
                email: prev.email || currentContact.email,
                phone: prev.phone || currentContact.phone
            };
        });
    };

    const scrapeContactInfo = async (): Promise<{ email: string, phone: string }> => {
        let email = "Not available";
        let phone = "Not available";

        const waitForElement = (selector: string, timeout = 5000): Promise<Element | null> => {
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
            const contactInfoLink = (document.querySelector('a#top-card-text-details-contact-info') as HTMLElement) || 
                                    (document.querySelector('a[href*="/overlay/contact-info/"]') as HTMLElement);
            
            if (contactInfoLink) {
                contactInfoLink.click();
                const modal = await waitForElement('.artdeco-modal');
                if (modal) {
                    await new Promise(r => setTimeout(r, 1000));

                    // REVERTED TO PRECISE SELECTORS (AS REQUESTED)
                    const emailAnchor = modal.querySelector('a[href^="mailto:"]');
                    if (emailAnchor) {
                        email = emailAnchor.textContent?.trim() || "Not available";
                    } else {
                        const emailSection = modal.querySelector('.pv-contact-info__contact-type--email');
                        if (emailSection) email = emailSection.textContent?.replace(/Email/i, '').trim() || "Not available";
                    }

                    const phoneSection = modal.querySelector('.pv-contact-info__contact-type--phone');
                    if (phoneSection) {
                        const phoneSpan = phoneSection.querySelector('span[dir="ltr"]') || phoneSection.querySelector('ul li span');
                        phone = phoneSpan?.textContent?.trim() || "Not available";
                    }

                    const closeBtn = modal.querySelector('.artdeco-modal__dismiss') as HTMLElement || modal.querySelector('button[aria-label="Dismiss"]') as HTMLElement;
                    if (closeBtn) closeBtn.click();
                }
            }
        } catch (e) {
            console.error("Scraper Error:", e);
        }
        return { email, phone };
    };

    const enrichData = async (type: 'email' | 'phone') => {
        if (!contact || loadingEnrich) return;
        setLoadingEnrich(true);
        const results = await scrapeContactInfo();
        
        setContact(prev => {
            if (!prev) return null;
            return {
                ...prev,
                email: results.email !== "Not available" ? results.email : (prev.email || "Not available"),
                phone: results.phone !== "Not available" ? results.phone : (prev.phone || "Not available")
            };
        });

        if ((type === 'email' && results.email !== "Not available") || (type === 'phone' && results.phone !== "Not available")) {
            showToast(`${type === 'email' ? 'Email' : 'Phone'} Scraped!`, 'success');
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
                list_name: listToUse,
                date_added: new Date().toISOString(),
                lists: [{ name: listToUse }]
            };

            chrome.storage.local.get(['contacts'], (result) => {
                const existingContacts = result.contacts || [];
                const filtered = existingContacts.filter((c: any) => getNormalizedUrl(c.linkedin_url) !== currentUrl);
                chrome.storage.local.set({ contacts: [...filtered, newContact] }, () => {
                    showToast(`Contact Saved!`, 'success');
                    setIsSaved(true);
                    setShowAddListInput(false);
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
        if (window.location.hostname === 'localhost' && window.location.port === '3000') {
            const syncToDashboard = () => {
                chrome.storage.local.get(['contacts'], (result) => {
                    window.postMessage({ type: 'SYNC_FROM_EXTENSION', data: result.contacts || [] }, '*');
                });
            };
            syncToDashboard();
            const storageListener = (changes: any) => { if (changes.contacts) syncToDashboard(); };
            chrome.storage.onChanged.addListener(storageListener);
            return () => chrome.storage.onChanged.removeListener(storageListener);
        }
    }, []);

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
                                {contact.about && <div><span style={{ fontWeight: '700' }}>About:</span> {contact.about.substring(0, 100)}...</div>}
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
                        <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', marginBottom: 8 }}>Email</p>
                        {contact?.email && contact.email !== 'Not available' && contact.email !== 'Not available on LinkedIn' ? (
                            <div style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700' }}>{contact.email}</div>
                        ) : (
                            <button onClick={() => enrichData('email')} disabled={loadingEnrich} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', fontWeight: '800' }}>{loadingEnrich ? 'Extracting...' : 'Access Email'}</button>
                        )}
                    </div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: '900', color: '#777', textTransform: 'uppercase', marginBottom: 8 }}>Phone numbers</p>
                        {contact?.phone && contact.phone !== 'Not available' && contact.phone !== 'Not available on LinkedIn' ? (
                            <div style={{ padding: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 13, fontWeight: '700' }}>{contact.phone}</div>
                        ) : (
                            <button onClick={() => enrichData('phone')} disabled={loadingEnrich} style={{ width: '100%', padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', fontWeight: '800' }}>{loadingEnrich ? 'Extracting...' : 'Access Phone'}</button>
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
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id && tab.url?.includes('linkedin.com/in/')) {
        try {
            // Try to toggle sidebar in the content script
            await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_SIDEBAR' });
        } catch (e) {
            // If content script is not ready, reload the tab to ensure it injects
            chrome.tabs.reload(tab.id);
        }
    } else {
        console.log('Not a LinkedIn profile page.');
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SAVE_CONTACT') {
        fetch('http://localhost:8000/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data)
        })
            .then(async res => {
                const isJson = res.headers.get('content-type')?.includes('application/json');
                const data = isJson ? await res.json() : null;

                if (res.ok) {
                    sendResponse({ success: true, data });
                } else {
                    const errorMsg = data?.detail || `Server Error (${res.status})`;
                    sendResponse({ success: false, error: errorMsg });
                }
            })
            .catch(err => {
                console.error('Background fetch error:', err);
                sendResponse({ success: false, error: 'Cannot connect to backend server. Make sure it is running at http://localhost:8000' });
            });
        return true;
    }

    if (request.action === 'FETCH_EXTERNAL_URL') {
        fetch(request.url)
            .then(res => res.text())
            .then(html => sendResponse({ html }))
            .catch(err => {
                console.error('External fetch error:', err);
                sendResponse({ error: err.message });
            });
        return true;
    }

    if (request.action === 'SEARCH_DOMAIN') {
        const query = encodeURIComponent(`site:linkedin.com/company/${request.companyName}`);
        const searchUrl = `https://www.google.com/search?q=${query}`;

        fetch(searchUrl)
            .then(res => res.text())
            .then(html => {
                // Look specifically for the company URL in Google results
                // We ignore common related links or ads by looking for the specific pattern
                const companyPageRegex = /https:\/\/www\.linkedin\.com\/company\/([a-zA-Z0-9-]+)(?:\/|\?|")/g;
                let match;
                while ((match = companyPageRegex.exec(html)) !== null) {
                    const slug = match[1];
                    // Skip common junk domains found in search results
                    if (!['centrox', 'sales-intelligence', 'google', 'linkedin'].includes(slug.toLowerCase())) {
                        const companyUrl = `https://www.linkedin.com/company/${slug}/about/`;
                        return fetch(companyUrl).then(res => res.text());
                    }
                }
                return null;
            })
                if (companyHtml) {
                    // Extract website from about page
                    // We look for URLs but exclude LinkedIn, Google, and other common internal/tracking hosts
                    const urlMatches = companyHtml.matchAll(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g);
                    const excludedDomains = ['linkedin.com', 'google.com', 'gstatic.com', 'microsoft.com', 'bing.com'];
                    
                    for (const match of urlMatches) {
                        try {
                            const url = match[0];
                            const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
                            
                            // Ensure it's not a LinkedIn internal link and not a major search engine
                            if (hostname && !excludedDomains.some(d => hostname.includes(d)) && hostname.includes('.')) {
                                sendResponse({ domain: hostname });
                                return;
                            }
                        } catch (e) {}
                    }
                }
                sendResponse({ domain: null });
            .catch(err => {
                console.error('Search domain error:', err);
                sendResponse({ domain: null });
            });
        return true;
    }

    if (request.action === 'enrich') {
        // ... existing enrich logic
        setTimeout(() => {
            sendResponse({
                email: null,
                phone: null,
                isMock: false
            });
        }, 300);
        return true;
    }
});
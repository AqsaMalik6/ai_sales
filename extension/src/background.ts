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
        fetch(request.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Referer': 'https://www.linkedin.com/'
            }
        })
            .then(res => res.text())
            .then(html => sendResponse({ html }))
            .catch(err => {
                console.error('External fetch error:', err);
                sendResponse({ error: err.message });
            });
        return true;
    }

    if (request.action === 'SEARCH_DOMAIN') {
        const query = encodeURIComponent(`${request.companyName} official website`);
        const searchUrl = `https://www.google.com/search?q=${query}`;

        fetch(searchUrl)
            .then(res => res.text())
            .then(html => {
                const matches = html.matchAll(/<a href="\/url\?q=(https?:\/\/[^&]+)/g);
                for (const match of matches) {
                    try {
                        const url = decodeURIComponent(match[1]);
                        const domain = new URL(url).hostname.replace('www.', '');
                        const blacklist = ['google.com', 'linkedin.com', 'facebook.com', 'twitter.com', 'w3.org', 'schema.org'];
                        if (!blacklist.some(b => domain.includes(b))) {
                            sendResponse({ domain });
                            return;
                        }
                    } catch (e) { }
                }
                sendResponse({ domain: null });
            })
            .catch(err => {
                sendResponse({ domain: null });
            });
        return true;
    }

    if (request.action === 'CHECK_SMTP_STATUS') {
        const hosts = ['localhost', '127.0.0.1'];
        const check = async () => {
            for (const host of hosts) {
                try {
                    const res = await fetch(`http://${host}:8001/verify`, { method: 'OPTIONS' });
                    if (res.ok || res.status === 200) return true;
                } catch (e) { }
            }
            return false;
        };
        check().then(online => sendResponse({ online }));
        return true;
    }

    if (request.action === 'VERIFY_EMAILS') {
        fetch('http://localhost:8001/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails: request.emails })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ error: 'OFFLINE' }));
        return true;
    }

    if (request.action === 'FORCE_DASHBOARD_SYNC') {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                const isDashboard = tab.url && (tab.url.includes('localhost:3000') || tab.url.includes('127.0.0.1:3000'));
                const isLinkedIn = tab.url && tab.url.includes('linkedin.com/in/');
                if (tab.id && (isDashboard || isLinkedIn)) {
                    chrome.tabs.sendMessage(tab.id, { action: 'SYNC_FROM_EXTENSION', data: request.data }).catch(() => { });
                }
            });
        });
        sendResponse({ success: true });
        return true;
    }
    /* 
    if (request.action === 'FETCH_RAPID_API') {
        const username = request.username;
        const url = `https://fresh-linkedin-scraper-api.p.rapidapi.com/api/v1/user/contact?username=${username}`;
        console.log('[Background] Fetching RapidAPI for:', username, url);

        fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': '7e5376842bmshf82aea835cd12a8p1a649ajsn76576d8a5dcc',
                'X-RapidAPI-Host': 'fresh-linkedin-scraper-api.p.rapidapi.com'
            }
        })
            .then(res => {
                console.log('[Background] RapidAPI HTTP Status:', res.status);
                return res.json();
            })
            .then(data => {
                console.log('[Background] RapidAPI Full JSON Response:\n', JSON.stringify(data, null, 2));
                sendResponse({ success: true, data });
            })
            .catch(err => {
                console.error('[Background] RapidAPI Error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }
    */
});
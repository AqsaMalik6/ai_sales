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
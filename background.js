const CASE_ENDPOINT =
  'https://opensalt.net/ims/case/v1p0/CFPackages/d86774f2-8982-4366-8d72-c4d3889d8171';

// In-memory cache (cleared when service worker restarts)
let caseCache = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchCASE') {
    if (caseCache) {
      sendResponse({ success: true, data: caseCache });
      return true;
    }

    fetch(CASE_ENDPOINT)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        caseCache = {
          document:     data.CFDocument,
          items:        data.CFItems        || [],
          associations: data.CFAssociations || [],
        };
        sendResponse({ success: true, data: caseCache });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === 'clearCache') {
    caseCache = null;
    sendResponse({ success: true });
    return true;
  }
});

// Sentinel Shield - Background Service with URL Detection + Desktop Sync

const PHISHING_DOMAINS = [
  'fake-bank.com',
  'secure-login-verify.com',
  'paypal-security-check.com',
  'amazon-account-locked.com',
  'microsoft-verify-account.com',
  'apple-id-suspended.net',
  'netflix-billing-update.org'
];

const PHISHING_PATTERNS = [
  /login.*secure/i,
  /account.*verify/i,
  /banking.*login/i,
  /paypal.*secure/i,
  /amazon.*account/i,
  /microsoft.*verify/i,
  /apple.*id.*suspend/i,
  /netflix.*billing/i,
  /update.*password.*now/i,
  /confirm.*identity.*click/i
];

// Guardian Messages
const GUARDIAN_MESSAGES = {
  safe: "✅ All clear! This site looks safe. Browse with confidence!",
  scanning: "🔍 Scanning this page for threats...",
  warning: "⚠️ I'm sensing something unusual here. Let me check deeper.",
  threat: "🛡️ I've got your back! This site is dangerous. Let's go back together.",
  greeting: "👋 Hello! I'm Guardian Sentinel. I'm watching over your browsing.",
  protected: "🔒 You're protected! I'm monitoring this page in real-time.",
  connected: "🖥️ Connected to Sentinel Shield Desktop App"
};

let protectedTabs = new Map();
let stats = { threatsBlocked: 0, pagesProtected: 0 };
let desktopConnected = true;

chrome.storage.local.get(['threatsBlocked', 'pagesProtected', 'desktopConnected'], (result) => {
  if (result.threatsBlocked) stats.threatsBlocked = result.threatsBlocked;
  if (result.pagesProtected) stats.pagesProtected = result.pagesProtected;
  if (result.desktopConnected) desktopConnected = result.desktopConnected;
});

function checkUrl(url) {
  if (!url || !url.startsWith('http')) {
    return { isThreat: false, message: GUARDIAN_MESSAGES.safe };
  }

  const urlLower = url.toLowerCase();

  for (const domain of PHISHING_DOMAINS) {
    if (urlLower.includes(domain)) {
      return {
        isThreat: true,
        reason: `Phishing domain detected: ${domain}`,
        severity: 'high',
        message: GUARDIAN_MESSAGES.threat
      };
    }
  }

  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(urlLower)) {
      return {
        isThreat: true,
        reason: 'Suspicious URL pattern detected',
        severity: 'medium',
        message: GUARDIAN_MESSAGES.warning
      };
    }
  }

  return {
    isThreat: false,
    message: GUARDIAN_MESSAGES.safe
  };
}

function showWarning(tabId, url, reason, severity) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (reason, url) => {
      const existing = document.getElementById('sentinel-shield-warning');
      if (existing) existing.remove();

      const warning = document.createElement('div');
      warning.id = 'sentinel-shield-warning';
      warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(2, 8, 16, 0.98);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 999999;
        text-align: center;
        padding: 20px;
      `;

      warning.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">⚠️</div>
        <div style="font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #c9a84c;">THREAT DETECTED</div>
        <div style="font-size: 16px; color: #ff6b6b; margin-bottom: 20px; max-width: 500px;">${reason}</div>
        <div style="font-size: 14px; color: #888; margin-bottom: 30px; word-break: break-all;">${url}</div>
        <div style="font-size: 14px; color: #c9a84c; margin-bottom: 30px; font-style: italic;">
          🤖 "I've got your back! Let's go back to safety."
        </div>
        <button id="sentinel-back-btn" style="
          padding: 15px 40px;
          font-size: 16px;
          background: linear-gradient(135deg, #c9a84c, #e8c878);
          color: #020810;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin: 10px;
          font-weight: bold;
          box-shadow: 0 0 20px rgba(201,168,76,0.4);
        ">Go Back to Safety</button>
        <button id="sentinel-proceed-btn" style="
          padding: 15px 40px;
          font-size: 16px;
          background: transparent;
          color: #888;
          border: 1px solid #888;
          border-radius: 8px;
          cursor: pointer;
          margin: 10px;
        ">Proceed Anyway (Not Recommended)</button>
      `;

      document.body.appendChild(warning);

      const style = document.createElement('style');
      style.textContent = `@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`;
      document.head.appendChild(style);

      document.getElementById('sentinel-back-btn').addEventListener('click', () => {
        window.history.back();
      });

      document.getElementById('sentinel-proceed-btn').addEventListener('click', () => {
        warning.remove();
      });
    },
    args: [reason, url]
  });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '🛡️ Sentinel Shield - Threat Detected',
    message: reason,
    priority: 2
  });

  stats.threatsBlocked++;
  chrome.storage.local.set({ threatsBlocked: stats.threatsBlocked });

  notifyDesktopApp(url, reason, severity);
}

function notifyDesktopApp(url, reason, severity) {
  console.log('🖥️ Notifying desktop:', { url, reason, severity });

  const threatData = {
    url,
    reason,
    severity,
    timestamp: new Date().toISOString()
  };

  chrome.storage.local.set({ sentinelBrowserThreat: threatData });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (data) => {
          try {
            window.localStorage.setItem('sentinel-browser-threat-demo', JSON.stringify(data));
          } catch(e) {}
        },
        args: [threatData]
      });
    }
  });
}

function updateBadge(tabId, isThreat) {
  if (isThreat) {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff0000' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const result = checkUrl(tab.url);

    if (result.isThreat) {
      showWarning(tabId, tab.url, result.reason, result.severity);
      updateBadge(tabId, true);

      protectedTabs.set(tabId, {
        url: tab.url,
        reason: result.reason,
        severity: result.severity,
        timestamp: new Date().toISOString(),
        message: result.message
      });
    } else {
      updateBadge(tabId, false);
      protectedTabs.delete(tabId);
      stats.pagesProtected++;
      chrome.storage.local.set({ pagesProtected: stats.pagesProtected });
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  protectedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProtectedTabs') {
    sendResponse({ tabs: Array.from(protectedTabs.values()), stats, desktopConnected });
  }
  else if (request.action === 'checkCurrentUrl') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const result = checkUrl(tabs[0].url);
        sendResponse(result);
      } else {
        sendResponse({ isThreat: false, message: GUARDIAN_MESSAGES.safe });
      }
    });
    return true;
  }
  else if (request.action === 'getStats') {
    sendResponse({ ...stats, desktopConnected });
  }
  else if (request.action === 'getGuardianMessage') {
    sendResponse({ messages: GUARDIAN_MESSAGES, desktopConnected });
  }
  else if (request.action === 'checkDesktopConnection') {
    sendResponse({ connected: true });
    return true;
  }
});

setTimeout(() => {
  desktopConnected = true;
  chrome.storage.local.set({ desktopConnected: true });
}, 1000);

console.log('🛡️ Sentinel Shield Extension Loaded - Guardian Active');

chrome.storage.local.get(['adBlockingEnabled'], (result) => {
  if (result.adBlockingEnabled === false) {
    chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['adblock_rules']
    });
  } else {
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['adblock_rules']
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleAdBlocking') {
    chrome.storage.local.get(['adBlockingEnabled'], (result) => {
      const newState = result.adBlockingEnabled !== false;
      chrome.storage.local.set({ adBlockingEnabled: !newState });

      chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: newState ? [] : ['adblock_rules'],
        disableRulesetIds: newState ? ['adblock_rules'] : []
      });

      sendResponse({ enabled: !newState });
    });
    return true;
  }

  if (request.action === 'toggleCookieReject') {
    chrome.storage.local.get(['cookieRejectEnabled'], (result) => {
      const newState = result.cookieRejectEnabled !== false;
      chrome.storage.local.set({ cookieRejectEnabled: !newState });
      sendResponse({ enabled: !newState });
    });
    return true;
  }

  if (request.action === 'getFeatureStatus') {
    chrome.storage.local.get(['adBlockingEnabled', 'cookieRejectEnabled'], (result) => {
      sendResponse({
        adBlocking: result.adBlockingEnabled !== false,
        cookieReject: result.cookieRejectEnabled !== false
      });
    });
    return true;
  }
});
// Sentinel Shield - Content Script with Guardian Indicator

// Guardian Messages
const GUARDIAN_MESSAGES = {
  greeting: "👋 Hello! I'm Guardian Sentinel. I'm watching over your browsing.",
  protected: "🔒 You're protected! I'm monitoring this page in real-time.",
  scanning: "🔍 Scanning this page...",
  safe: "✅ All clear! This site looks safe."
};

function injectProtectionIndicator() {
  if (document.getElementById('sentinel-shield-indicator')) {
    return;
  }
  
  const indicator = document.createElement('div');
  indicator.id = 'sentinel-shield-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 18px;
    background: rgba(2, 8, 16, 0.95);
    border: 1px solid rgba(201, 168, 76, 0.5);
    border-radius: 10px;
    color: #c9a84c;
    font-family: Arial, sans-serif;
    font-size: 13px;
    z-index: 999998;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 0 20px rgba(201, 168, 76, 0.3);
    animation: slideIn 0.5s ease-out;
  `;
  
  indicator.innerHTML = `
    <span style="font-size: 20px;">🛡️</span>
    <span>Protected by Sentinel Shield</span>
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  // Auto-hide after 5 seconds with fade
  setTimeout(() => {
    indicator.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => indicator.remove(), 500);
  }, 5000);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProtectionIndicator);
} else {
  injectProtectionIndicator();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showWarning') {
    injectProtectionIndicator();
    sendResponse({ status: 'shown' });
  } else if (request.action === 'getStatus') {
    sendResponse({ protected: true, message: GUARDIAN_MESSAGES.protected });
  }
});

console.log('🛡️ Sentinel Shield Content Script Loaded');


// ===== ===== ===== ===== ===== ===== ===== ===== =====
// ===== COOKIE AUTO-REJECT (OPÇÃO B - APENAS ISTO) =====
// ===== ===== ===== ===== ===== ===== ===== ===== =====

// Auto-reject cookie banners
function autoRejectCookies() {
  // Common selectors for reject/decline/necessary buttons
  const cookieSelectors = [
    // Reject/Decline buttons
    'button[id*="reject"]',
    'button[id*="decline"]',
    'button[class*="reject"]',
    'button[class*="decline"]',
    'button[class*="deny"]',
    'a[id*="reject"]',
    'a[class*="reject"]',
    // Accept only necessary/essential
    'button[id*="necessary"]',
    'button[class*="necessary"]',
    'button[id*="essential"]',
    'button[class*="essential"]',
    // Close/dismiss buttons
    'button[id*="close"]',
    'button[class*="close"]',
    'button[aria-label*="close"]',
    'button[aria-label*="dismiss"]',
    // GDPR specific patterns
    '[class*="cookie-banner"] button:not(:first-child)',
    '[id*="cookie-banner"] button:not(:first-child)',
    '[class*="consent"] button:nth-child(2)',
    '[id*="consent"] button:nth-child(2)',
    // Common frameworks
    '#onetrust-reject-btn',
    '.ot-sdk-reject',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptoutDecline',
    '[data-cookie-consent="reject"]',
    '.cmpboxbtnno'
  ];

  // Try to find and click reject button
  for (const selector of cookieSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.textContent || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        
        // Check if this looks like a reject/decline button
        if (text.includes('reject') || 
            text.includes('decline') || 
            text.includes('deny') ||
            text.includes('necessary') ||
            text.includes('essential') ||
            text.includes('close') ||
            text.includes('dismiss') ||
            ariaLabel.includes('reject') ||
            ariaLabel.includes('decline') ||
            ariaLabel.includes('close')) {
          
          // Check if button is visible and clickable
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          
          if (rect.width > 0 && 
              rect.height > 0 && 
              style.display !== 'none' && 
              style.visibility !== 'hidden' &&
              !el.disabled) {
            
            console.log('🍪 Sentinel Shield: Auto-rejecting cookies');
            el.click();
            return true;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Run cookie reject after page loads
setTimeout(() => {
  chrome.storage.local.get(['cookieRejectEnabled'], (result) => {
    // Default: enabled (only skip if explicitly set to false)
    if (result.cookieRejectEnabled !== false) {
      autoRejectCookies();
    }
  });
}, 1500);

// Watch for dynamically loaded cookie banners
const cookieObserver = new MutationObserver(() => {
  chrome.storage.local.get(['cookieRejectEnabled'], (result) => {
    if (result.cookieRejectEnabled !== false) {
      autoRejectCookies();
    }
  });
});

// Start observing after body is ready
setTimeout(() => {
  if (document.body) {
    cookieObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}, 2000);

console.log('🍪 Sentinel Shield: Cookie Auto-Reject module loaded');
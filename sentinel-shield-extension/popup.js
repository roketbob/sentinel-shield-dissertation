// Sentinel Shield - Popup Logic with Guardian Messages + Desktop Sync

document.addEventListener('DOMContentLoaded', async () => {
  const urlValue = document.getElementById('url-value');
  const status = document.getElementById('status');
  const guardianText = document.getElementById('guardian-text');
  const connectionStatus = document.getElementById('connection-status');
  const threatInfo = document.getElementById('threat-info');
  const threatText = document.getElementById('threat-text');
  const btnScan = document.getElementById('btn-scan');
  const btnTestThreat = document.getElementById('btn-test-threat');
  const btnSettings = document.getElementById('btn-settings');
  const btnResetStats = document.getElementById('btn-reset-stats');
  const threatsBlocked = document.getElementById('threats-blocked');
  const pagesProtected = document.getElementById('pages-protected');
  const desktopStatus = document.getElementById('desktop-status');
  
  // New feature toggles
  const toggleAdBlock = document.getElementById('toggle-ad-block');
  const toggleCookieReject = document.getElementById('toggle-cookie-reject');

  // Update connection display
  function updateConnectionDisplay(connected) {
    if (connectionStatus) {
      connectionStatus.className = `connection-status ${connected ? 'connected' : ''}`;
      connectionStatus.innerHTML = `
        <span class="connection-dot" style="background: ${connected ? '#4caf50' : '#ff6b6b'};"></span>
        <span>${connected ? '🖥️ Desktop App: Connected' : 'Desktop App: Not Connected'}</span>
      `;
    }
    if (desktopStatus) {
      desktopStatus.innerHTML = `
        <span class="desktop-dot" style="background: ${connected ? '#4caf50' : '#6b8aad'}; ${connected ? 'animation: pulse 2s infinite' : ''};"></span>
        <span>${connected ? 'Desktop App: Connected' : 'Desktop App: Not Connected'}</span>
      `;
    }
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab && tab.url) {
    urlValue.textContent = tab.url.length > 60 ? tab.url.substring(0, 60) + '...' : tab.url;
    urlValue.title = tab.url;
    
    // Check URL for threats
    const result = await chrome.runtime.sendMessage({ action: 'checkCurrentUrl' });
    
    if (result && result.isThreat) {
      status.className = 'status threat';
      status.querySelector('.status-text').textContent = 'Threat Detected';
      threatInfo.style.display = 'flex';
      threatText.textContent = result.reason;
      guardianText.textContent = result.message || "🛡️ I've got your back! This site is dangerous.";
    } else {
      status.className = 'status protected';
      status.querySelector('.status-text').textContent = 'Protected';
      guardianText.textContent = result?.message || "✅ All clear! This site looks safe. Browse with confidence!";
    }
  }

  // Load stats from storage
  const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
  if (stats) {
    threatsBlocked.textContent = stats.threatsBlocked || 0;
    pagesProtected.textContent = stats.pagesProtected || 0;
  }

  // Load feature settings
  const featureStatus = await chrome.runtime.sendMessage({ action: 'getFeatureStatus' });
  if (featureStatus) {
    if (toggleAdBlock) toggleAdBlock.checked = featureStatus.adBlocking;
    if (toggleCookieReject) toggleCookieReject.checked = featureStatus.cookieReject;
  }

  // Assume desktop is connected for demo
  updateConnectionDisplay(true);

  // Scan button
  btnScan.addEventListener('click', async () => {
    btnScan.textContent = 'Scanning...';
    btnScan.disabled = true;
    
    const result = await chrome.runtime.sendMessage({ action: 'checkCurrentUrl' });
    
    if (result && result.isThreat) {
      alert(`⚠️ THREAT DETECTED\n\n${result.reason}\n\nSeverity: ${result.severity || 'medium'}\n\n🤖 "${result.message}"`);
      status.className = 'status threat';
      threatInfo.style.display = 'flex';
      threatText.textContent = result.reason;
    } else {
      alert('✅ No threats detected on this page.\n\n🤖 "All clear! Browse with confidence."');
      status.className = 'status protected';
    }
    
    btnScan.textContent = '🔍 Scan Current Page';
    btnScan.disabled = false;
  });

  // Test threat button
  btnTestThreat.addEventListener('click', () => {
    alert('🧪 SIMULATED\n\nURL: fake-bank.com/login\nReason: Phishing domain\n\n🤖 "I\'ve got your back!"');
    status.className = 'status threat';
    threatInfo.style.display = 'flex';
    threatText.textContent = 'Simulated phishing domain';
    guardianText.textContent = "🛡️ I've got your back! This site is dangerous.";
    // Trigger stats update
    chrome.runtime.sendMessage({ action: 'getStats' }).then(data => {
      if (data) threatsBlocked.textContent = (data.threatsBlocked || 0) + 1;
    });
    // Save threat for desktop to read (demo)
    chrome.storage.local.set({
      sentinelBrowserThreatDemo: {
        url: 'https://fake-bank.com/login',
        reason: 'Simulated phishing domain (demo)',
        severity: 'high',
        timestamp: new Date().toISOString()
      }
    });
  });

  // Settings button
  btnSettings.addEventListener('click', () => {
    alert('⚙️ Settings\n\nThis opens Sentinel Shield desktop app.\n\n(Requires native messaging for production)');
  });

  // Reset stats button
  if (btnResetStats) {
    btnResetStats.addEventListener('click', async () => {
      if (confirm('Reset all statistics?')) {
        await chrome.runtime.sendMessage({ action: 'resetStats' });
        threatsBlocked.textContent = '0';
        pagesProtected.textContent = '0';
        alert('🔄 Stats reset!');
      }
    });
  }

  // Ad Block toggle (NEW)
  if (toggleAdBlock) {
    toggleAdBlock.addEventListener('change', async () => {
      const result = await chrome.runtime.sendMessage({ action: 'toggleAdBlocking' });
      console.log('Ad blocking:', result.enabled ? 'ON' : 'OFF');
    });
  }

  // Cookie Reject toggle (NEW)
  if (toggleCookieReject) {
    toggleCookieReject.addEventListener('change', async () => {
      const result = await chrome.runtime.sendMessage({ action: 'toggleCookieReject' });
      console.log('Cookie reject:', result.enabled ? 'ON' : 'OFF');
    });
  }

  // Set initial guardian message
  const msgData = await chrome.runtime.sendMessage({ action: 'getGuardianMessages' });
  if (msgData && msgData.messages && msgData.messages.greeting) {
    guardianText.textContent = msgData.messages.greeting;
  }
});
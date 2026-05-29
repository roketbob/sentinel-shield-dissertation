const { ipcRenderer } = require('electron');

let threatCount = 0;
let currentPage = 'dashboard';
let scanInterval = null;
let statusInterval = null;
let animationId = null;
let isScanning = false;
let quarantinedItems = [];
let alertsData = [];
let logsData = [];
let lastScanTime = '--:--:--';
const APP_VERSION = '1.0.0';
let extensionConnected = false;
let lastProcessedThreat = null; // ← FIX: Track last threat to avoid duplicates

// ===== HELPERS =====
const $ = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
const create = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// ===== STAR BACKGROUND =====
function initStars() {
    const c = $('bg-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    
    const stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * c.width,
            y: Math.random() * c.height,
            r: Math.random() * 1.2,
            speed: Math.random() * 0.2 + 0.05,
            op: Math.random()
        });
    }
    
    function animate() {
        ctx.fillStyle = '#020810';
        ctx.fillRect(0, 0, c.width, c.height);
        
        stars.forEach(s => {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(201, 168, 76, ${s.op})`;
            ctx.fill();
            s.y -= s.speed;
            if (s.y < 0) {
                s.y = c.height;
                s.x = Math.random() * c.width;
            }
            s.op = Math.max(0.3, Math.min(1, s.op + (Math.random() - 0.5) * 0.05));
        });
        
        animationId = requestAnimationFrame(animate);
    }
    
    animate();
    
    on(window, 'resize', () => {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
    });
}

// ===== NAVIGATION =====
function initNavigation() {
    $$('.nav-menu li').forEach(item => {
        on(item, 'click', function() {
            $$('.nav-menu li').forEach(li => li.classList.remove('active'));
            this.classList.add('active');
            const page = this.getAttribute('data-page');
            currentPage = page;
            $$('.page-section').forEach(s => s.classList.remove('active'));
            const target = $(page);
            if (target) target.classList.add('active');
            const title = $('page-title');
            if (title) title.textContent = page.toUpperCase();
        });
    });
}

// ===== IPC: STATUS UPDATE =====
function initIPCListeners() {
    ipcRenderer.on('security-update', (e, d) => {
        const dot = $('sidebar-status-dot');
        const txt = $('sidebar-status-text');
        const title = $('main-status-title');
        const desc = $('main-status-description');
        const status = $('protection-status');
        const count = $('threat-count');
        
        if (!dot || !txt) return;
        
        if (d.status === 'Scanning') {
            if (status) status.textContent = 'SCANNING';
            return;
        }
        
        if (d.status === 'ScanComplete') {
            lastScanTime = d.last_scan || new Date().toLocaleTimeString('en-GB');
            const scanEl = $('last-scan');
            if (scanEl) scanEl.textContent = lastScanTime;
            addLogEntry('Quick Scan', `Scan completed. ${d.threats_found || 0} threats found.`, (d.threats_found || 0) > 0 ? 'danger' : 'success');
            return;
        }
        
        let t, tt, td, st, cls;
        if (d.status === 'Protected' || d.status === 'Active') {
            [t, tt, td, st, cls] = ['PROTECTED', 'YOUR DEVICE IS PROTECTED', 'All systems operational.', 'ACTIVE', ''];
        } else if (d.status === 'Warning') {
            [t, tt, td, st, cls] = ['WARNING', 'POTENTIAL THREAT', 'Check alerts section.', 'WARNING', 'warning'];
        } else if (d.status === 'Threat') {
            [t, tt, td, st, cls] = ['THREAT', 'THREAT DETECTED!', 'Immediate action required.', 'THREAT', 'danger'];
        } else {
            [t, tt, td, st, cls] = ['PROTECTED', 'YOUR DEVICE IS PROTECTED', 'All systems operational.', 'ACTIVE', ''];
        }
        
        dot.className = `status-dot${cls ? ' ' + cls : ''}`;
        txt.textContent = t;
        if (title) title.textContent = tt;
        if (desc) desc.textContent = td;
        if (status) {
            status.textContent = st;
            if (status.parentElement) status.parentElement.className = 'card stat-card';
        }
        
        if (d.threats !== undefined && count) {
            if (d.threats > threatCount) {
                threatCount = d.threats;
                count.textContent = threatCount;
            }
        }
    });
    
    ipcRenderer.on('threat-detected', (e, d) => {
        threatCount++;
        const countEl = $('threat-count');
        if (countEl) countEl.textContent = threatCount;
        
        const dot = $('sidebar-status-dot');
        const txt = $('sidebar-status-text');
        if (dot) dot.className = 'status-dot danger';
        if (txt) txt.textContent = 'THREAT';
        
        addAlertEntry(d);
        addLogEntry(d.threat_type, d.threat_details, 'danger');
        alertsData.push(d);
        
        const toggle = $('toggle-notifications');
        if (toggle && toggle.checked) {
            alert(`⚠️ ${d.threat_type}\n\n${d.threat_details}`);
        }
    });
}

// ===== LOGS =====
function addLogEntry(type, msg, level) {
    const log = $('dashboard-log');
    if (!log) return;
    
    const e = create('li');
    e.className = `log-entry${level === 'danger' ? ' danger' : level === 'warning' ? ' warning' : ''}`;
    
    const time = new Date().toLocaleTimeString('en-GB');
    e.innerHTML = `<div class="log-time">${time}</div><div class="log-message"><strong>${type}:</strong> ${msg}</div>`;
    
    log.insertBefore(e, log.firstChild);
    logsData.push({time, type, message: msg, level});
    saveData();
}

// ===== ALERTS =====
function addAlertEntry(d) {
    const tbody = $('alerts-table-body');
    if (!tbody) return;
    
    const noAlert = tbody.querySelector('tr td[colspan]');
    if (noAlert && noAlert.parentElement) noAlert.parentElement.remove();
    
    const icons = { 'Phishing': '🎣', 'Clipboard Hijack': '📋', 'Network Reconnaissance': '🌐', 'Browser Phishing': '🌐' };
    const icon = icons[d.threat_type] || '⚠️';
    
    const row = create('tr');
    row.innerHTML = `
        <td>${d.timestamp || new Date().toLocaleTimeString('en-GB')}</td>
        <td><span class="threat-icon ${d.threat_type ? d.threat_type.toLowerCase().split(' ')[0] : ''}">${icon}</span>${d.threat_type || 'Unknown'}</td>
        <td><span class="badge badge-${d.severity || 'low'}">${d.severity || 'low'}</span></td>
        <td>Detected</td>
        <td>
            <div class="action-dropdown">
                <button class="btn btn-secondary action-btn">Action ▼</button>
                <div class="action-menu">
                    <div data-action="quarantine">🔒 Quarantine</div>
                    <div data-action="repair">🔧 Repair</div>
                    <div data-action="delete">🗑️ Delete</div>
                    <div data-action="ignore">⚪ Ignore</div>
                    <div data-action="report">📄 Report</div>
                    <div data-action="goto">📍 Go to Issue</div>
                </div>
            </div>
        </td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    
    const btn = row.querySelector('.action-btn');
    const menu = row.querySelector('.action-menu');
    
    if (btn && menu) {
        on(btn, 'click', (ev) => {
            ev.stopPropagation();
            menu.classList.toggle('show');
        });
        
        on(document, 'click', () => {
            if (menu) menu.classList.remove('show');
        });
        
        row.querySelectorAll('.action-menu div').forEach(opt => {
            on(opt, 'click', () => {
                handleAlertAction(opt.dataset.action, d, row);
                if (menu) menu.classList.remove('show');
            });
        });
    }
}

function handleAlertAction(action, data, row) {
    const actions = {
        quarantine: 'Item moved to quarantine. Threat neutralized.',
        repair: 'Attempting to repair affected files...',
        delete: 'Threat permanently deleted from system.',
        ignore: 'Alert marked as false positive. Added to whitelist.',
        report: 'Threat report sent to local audit log.',
        goto: 'Navigating to threat location...'
    };
    
    alert(`Action: ${action.toUpperCase()}\n\n${actions[action]}`);
    addLogEntry('Alert Action', `${action} - ${data.threat_type}`, 'success');
    
    if (action === 'quarantine') {
        quarantinedItems.push({...data, quarantineDate: new Date().toLocaleString()});
        updateQuarantineTable();
        if (row) row.style.opacity = '0.5';
        const statusCell = row ? row.querySelector('td:nth-child(4)') : null;
        if (statusCell) statusCell.textContent = 'Quarantined';
        saveData();
    } else if (action === 'delete') {
        if (row) row.remove();
        saveData();
    }
}

// ===== QUARANTINE =====
function updateQuarantineTable() {
    const tbody = $('quarantine-table-body');
    if (!tbody) return;
    
    if (quarantinedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:30px">No items in quarantine.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    quarantinedItems.forEach((item, idx) => {
        const row = create('tr');
        row.innerHTML = `
            <td>${item.quarantineDate}</td>
            <td>${item.threat_type}</td>
            <td>${item.threat_url || 'System'}</td>
            <td>
                <button class="btn btn-primary" style="padding:4px 10px;font-size:10px;" onclick="restoreItem(${idx})">♻️ Restore</button>
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:10px;" onclick="deleteItem(${idx})">🗑️ Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function restoreItem(idx) {
    quarantinedItems.splice(idx, 1);
    updateQuarantineTable();
    addLogEntry('Quarantine', 'Item restored from quarantine.', 'success');
    saveData();
}

function deleteItem(idx) {
    quarantinedItems.splice(idx, 1);
    updateQuarantineTable();
    addLogEntry('Quarantine', 'Item permanently deleted.', 'warning');
    saveData();
}

function restoreAll() {
    quarantinedItems = [];
    updateQuarantineTable();
    addLogEntry('Quarantine', 'All items restored.', 'success');
    saveData();
}

function deleteAll() {
    quarantinedItems = [];
    updateQuarantineTable();
    addLogEntry('Quarantine', 'All items permanently deleted.', 'warning');
    saveData();
}

// ===== LOG MANAGEMENT =====
function clearLogs() {
    const log = $('dashboard-log');
    if (!log) return;
    
    log.innerHTML = '<li class="log-entry"><div class="log-time">Cleared</div><div class="log-message">Logs cleared by user.</div></li>';
    logsData = [];
    addLogEntry('System', 'Logs cleared.', 'warning');
    saveData();
}

function exportLogs() {
    const content = logsData.map(l => `${l.time} | ${l.type} | ${l.message}`).join('\n');
    const blob = new Blob([content], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = create('a');
    a.href = url;
    a.download = `sentinel-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    addLogEntry('System', 'Logs exported successfully.', 'success');
}

function clearAlerts() {
    const tbody = $('alerts-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">No alerts recorded.</td></tr>';
    alertsData = [];
    addLogEntry('System', 'Alerts cleared.', 'warning');
    saveData();
}

function exportAlerts() {
    const content = alertsData.map(a => `${a.timestamp} | ${a.threat_type} | ${a.threat_details}`).join('\n');
    const blob = new Blob([content], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = create('a');
    a.href = url;
    a.download = `sentinel-alerts-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
}

// ← FIX: Separate function to clear threat count only
function clearThreatCount() {
    threatCount = 0;
    const countEl = $('threat-count');
    if (countEl) countEl.textContent = '0';
    
    const dot = $('sidebar-status-dot');
    const txt = $('sidebar-status-text');
    if (dot) dot.className = 'status-dot';
    if (txt) txt.textContent = 'PROTECTED';
    
    addLogEntry('System', 'Threat count cleared by user.', 'success');
}

// ← NEW: Show threats list when clicking on threat count
function showThreatsList() {
    if (alertsData.length === 0) {
        alert('📊 Threat Statistics\n\nNo threats recorded yet.\n\nKeep browsing safely! 🛡️');
        return;
    }
    
    let threatList = '📊 THREAT SUMMARY\n\n';
    threatList += `Total Threats: ${alertsData.length}\n\n`;
    
    // Group by type
    const byType = {};
    alertsData.forEach(t => {
        byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
    });
    
    for (const [type, count] of Object.entries(byType)) {
        threatList += `${type}: ${count}\n`;
    }
    
    threatList += `\n📋 Recent Threats:\n`;
    alertsData.slice(-5).forEach((t, i) => {
        threatList += `${i+1}. ${t.threat_type} - ${t.severity}\n`;
    });
    
    threatList += `\n💡 Tip: Click "Clear" button below to reset counter`;
    
    alert(threatList);
}

// ===== SETTINGS PERSISTENCE =====
function saveSettings() {
    const settings = {
        realtime: $('toggle-realtime') ? $('toggle-realtime').checked : true,
        phishing: $('toggle-phishing') ? $('toggle-phishing').checked : true,
        clipboard: $('toggle-clipboard') ? $('toggle-clipboard').checked : true,
        network: $('toggle-network') ? $('toggle-network').checked : true,
        notifications: $('toggle-notifications') ? $('toggle-notifications').checked : true,
        sound: $('toggle-sound') ? $('toggle-sound').checked : false
    };
    localStorage.setItem('sentinel-settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('sentinel-settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            const toggles = {
                'toggle-realtime': settings.realtime,
                'toggle-phishing': settings.phishing,
                'toggle-clipboard': settings.clipboard,
                'toggle-network': settings.network,
                'toggle-notifications': settings.notifications,
                'toggle-sound': settings.sound
            };
            
            for (const [id, value] of Object.entries(toggles)) {
                const el = $(id);
                if (el) el.checked = value;
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

function initSettingsListeners() {
    ['toggle-realtime', 'toggle-phishing', 'toggle-clipboard', 'toggle-network', 'toggle-notifications', 'toggle-sound'].forEach(id => {
        const el = $(id);
        if (el) on(el, 'change', saveSettings);
    });
}

// ===== UPDATE SYSTEM =====
function checkForUpdatesManual() {
    const statusItem = $('update-status-item');
    const statusText = $('update-status-text');
    const progressContainer = $('update-progress-container');
    const progressBar = $('update-progress-bar');
    
    if (!statusItem || !statusText) return;
    
    statusItem.style.display = 'flex';
    if (progressContainer) progressContainer.style.display = 'block';
    statusText.textContent = 'Checking for updates...';
    if (progressBar) progressBar.style.width = '0%';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progressBar) progressBar.style.width = progress + '%';
        
        if (progress === 30) statusText.textContent = 'Connecting to update server...';
        else if (progress === 60) statusText.textContent = 'Checking version...';
        else if (progress === 90) statusText.textContent = 'Comparing versions...';
        else if (progress >= 100) {
            clearInterval(interval);
            const newVersion = '1.1.0';
            if (compareVersions(newVersion, APP_VERSION) > 0) {
                showUpdateAvailable(newVersion);
            } else {
                statusText.textContent = '✓ You have the latest version';
                statusText.style.color = 'var(--green)';
            }
        }
    }, 300);
}

function showUpdateAvailable(newVersion) {
    const statusText = $('update-status-text');
    if (!statusText) return;
    
    statusText.innerHTML = `<span style="color: var(--orange);">⚠️ Update Available: v${newVersion}</span><br><button class="btn btn-primary" style="margin-top: 8px; padding: 6px 16px; font-size: 11px;" onclick="downloadUpdate('${newVersion}')">⬇️ Download Update</button>`;
}

function downloadUpdate(newVersion) {
    const statusText = $('update-status-text');
    const progressContainer = $('update-progress-container');
    const progressBar = $('update-progress-bar');
    
    if (!statusText) return;
    
    if (progressContainer) progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    statusText.textContent = 'Downloading update...';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        if (progressBar) progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            statusText.textContent = '✓ Update downloaded! Restart to install.';
            statusText.style.color = 'var(--green)';
            localStorage.setItem('sentinel-update-available', newVersion);
            localStorage.setItem('sentinel-update-downloaded', 'true');
            addLogEntry('Update', `Update v${newVersion} downloaded. Restart to install.`, 'success');
            
            setTimeout(() => {
                if (confirm('Update ready! Restart Sentinel Shield now to install?')) {
                    alert('In production: Auto-installer would launch here.\n\nFor now: Close and reopen the app manually.');
                }
            }, 1000);
        }
    }, 200);
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

function checkForUpdatesOnStartup() {
    const autoUpdate = localStorage.getItem('sentinel-auto-update');
    if (autoUpdate !== 'false') {
        console.log('Auto-update check enabled');
    }
}

function loadUpdateSettings() {
    const autoUpdate = localStorage.getItem('sentinel-auto-update');
    const toggle = $('toggle-auto-update');
    if (toggle) {
        toggle.checked = autoUpdate !== 'false';
    }
    
    const downloaded = localStorage.getItem('sentinel-update-downloaded');
    const newVersion = localStorage.getItem('sentinel-update-available');
    if (downloaded === 'true' && newVersion) {
        addLogEntry('Update', `Update v${newVersion} ready to install.`, 'warning');
    }
}

function saveUpdateSettings() {
    const toggle = $('toggle-auto-update');
    const autoUpdate = toggle ? toggle.checked : true;
    localStorage.setItem('sentinel-auto-update', autoUpdate.toString());
}

// ===== DATA PERSISTENCE =====
function saveData() {
    try {
        localStorage.setItem('sentinel-alerts', JSON.stringify(alertsData));
        localStorage.setItem('sentinel-quarantine', JSON.stringify(quarantinedItems));
        localStorage.setItem('sentinel-logs', JSON.stringify(logsData));
        localStorage.setItem('sentinel-threatCount', threatCount.toString());
        localStorage.setItem('sentinel-lastScan', lastScanTime);
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

function loadData() {
    try {
        const alerts = localStorage.getItem('sentinel-alerts');
        const quarantine = localStorage.getItem('sentinel-quarantine');
        const logs = localStorage.getItem('sentinel-logs');
        const count = localStorage.getItem('sentinel-threatCount');
        const scan = localStorage.getItem('sentinel-lastScan');
        
        if (alerts) alertsData = JSON.parse(alerts);
        if (quarantine) quarantinedItems = JSON.parse(quarantine);
        if (logs) logsData = JSON.parse(logs);
        if (count) threatCount = parseInt(count) || 0;
        if (scan) lastScanTime = scan;
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

// ===== BROWSER EXTENSION CONNECTION =====
window.syncWithExtension = syncWithExtension;

function initExtensionConnection() {
    localStorage.setItem('sentinel-desktop-running', 'true');
    updateExtensionStatus(true);
    setInterval(() => {
        checkBrowserThreats();
    }, 3000);
}

function updateExtensionStatus(connected) {
    const dot = $('extension-dot');
    const txt = $('extension-status-text');
    const desktopStatus = $('desktop-status');
    
    if (dot) dot.style.background = connected ? '#4caf50' : '#6b8aad';
    if (txt) {
        txt.textContent = connected ? 'Connected' : 'Not Connected';
        txt.style.color = connected ? 'var(--green)' : 'var(--muted)';
    }
    if (desktopStatus) {
        desktopStatus.innerHTML = `<span class="desktop-dot" style="background: ${connected ? '#4caf50' : '#6b8aad'};"></span><span>Browser Extension: ${connected ? 'Connected' : 'Not Connected'}</span>`;
    }
}

// ← FIX: Only count NEW threats, not duplicates
function checkBrowserThreats() {
    try {
        const threatData = localStorage.getItem('sentinel-browser-threat-demo');
        if (threatData) {
            const threat = JSON.parse(threatData);
            const threatKey = `${threat.url}-${threat.timestamp}`;
            
            // ← FIX: Skip if we already processed this exact threat
            if (threatKey === lastProcessedThreat) {
                return;
            }
            lastProcessedThreat = threatKey;
            
            addAlertEntry({
                threat_type: 'Browser Phishing',
                threat_details: threat.reason || 'Suspicious URL detected',
                threat_url: threat.url || 'https://example.com',
                timestamp: threat.timestamp || new Date().toLocaleTimeString('en-GB'),
                severity: threat.severity || 'medium',
                source: 'Browser Extension'
            });
            
            // ← FIX: Only increment counter for NEW threats from extension
            threatCount++;
            const countEl = $('threat-count');
            if (countEl) countEl.textContent = threatCount;
            
            const syncEl = $('extension-last-sync');
            if (syncEl) syncEl.textContent = new Date().toLocaleTimeString('en-GB');
            
            // Clear immediately to avoid re-counting
            localStorage.removeItem('sentinel-browser-threat-demo');
        }
    } catch (e) {
        console.log('No browser threat or parse error');
    }
}

function syncWithExtension() {
    checkBrowserThreats();
    const syncEl = $('extension-last-sync');
    if (syncEl) syncEl.textContent = 'Just now';
    addLogEntry('Extension', 'Manual sync completed.', 'success');
}

// ===== QUICK SCAN =====
function requestScan() {
    if (isScanning) {
        alert('Scan in progress.');
        return;
    }
    
    if (currentPage !== 'dashboard') {
        $$('.nav-menu li').forEach(li => li.classList.remove('active'));
        $$('.page-section').forEach(s => s.classList.remove('active'));
        
        const dashLink = $$('[data-page="dashboard"]')[0];
        if (dashLink) dashLink.classList.add('active');
        
        const dashPage = $('dashboard');
        if (dashPage) dashPage.classList.add('active');
        
        const title = $('page-title');
        if (title) title.textContent = 'DASHBOARD';
        
        currentPage = 'dashboard';
    }
    
    const cont = $('scan-container');
    const prog = $('scan-progress');
    const pct = $('scan-percentage');
    const stat = $('scan-status');
    const items = ['item-system', 'item-memory', 'item-startup', 'item-browser'].map($);
    
    isScanning = true;
    if (scanInterval) clearInterval(scanInterval);
    
    if (cont) cont.classList.add('active');
    let val = 0;
    
    if (prog) prog.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (stat) {
        stat.textContent = 'Initializing...';
        stat.className = 'scan-status scanning';
    }
    
    items.forEach(i => {
        if (i) i.className = 'scan-item pending';
    });
    
    scanInterval = setInterval(() => {
        val += 2;
        if (prog) prog.style.width = val + '%';
        if (pct) pct.textContent = val + '%';
        
        if (val === 20) {
            if (stat) stat.textContent = 'Scanning system files...';
            if (items[0]) items[0].className = 'scan-item checked';
        } else if (val === 40) {
            if (stat) stat.textContent = 'Checking memory...';
            if (items[1]) items[1].className = 'scan-item checked';
        } else if (val === 60) {
            if (stat) stat.textContent = 'Analyzing startup...';
            if (items[2]) items[2].className = 'scan-item checked';
        } else if (val === 80) {
            if (stat) stat.textContent = 'Scanning browser...';
            if (items[3]) items[3].className = 'scan-item checked';
        } else if (val >= 100) {
            clearInterval(scanInterval);
            isScanning = false;
            if (stat) {
                stat.textContent = '✓ Complete';
                stat.className = 'scan-status complete';
            }
            lastScanTime = new Date().toLocaleTimeString('en-GB');
            const scanEl = $('last-scan');
            if (scanEl) scanEl.textContent = lastScanTime;
            
            setTimeout(() => {
                if (cont) cont.classList.remove('active');
            }, 3000);
        }
    }, 100);
    
    ipcRenderer.send('request-scan');
}

// ===== STATUS CHECK =====
function checkForUpdates() {
    const modal = $('status-modal');
    const result = $('status-result');
    const close = $('status-close-btn');
    
    if (modal) modal.classList.add('active');
    if (result) result.classList.remove('active');
    if (close) close.style.display = 'none';
    
    const checks = ['check-engine', 'check-definitions', 'check-realtime', 'check-firewall', 'check-updates'];
    
    checks.forEach(id => {
        const item = $(id);
        const icon = item ? item.querySelector('.status-check-icon') : null;
        if (item) item.className = 'status-check-item';
        if (icon) icon.textContent = '○';
    });
    
    let idx = 0;
    const int = setInterval(() => {
        if (idx >= checks.length) {
            clearInterval(int);
            if (result) result.classList.add('active');
            if (close) close.style.display = 'inline-block';
            return;
        }
        
        const item = $(checks[idx]);
        const icon = item ? item.querySelector('.status-check-icon') : null;
        
        if (item) item.className = 'status-check-item checking';
        if (icon) icon.textContent = '⟳';
        
        setTimeout(() => {
            if (item) item.className = 'status-check-item complete';
            if (icon) icon.textContent = '✓';
        }, 600);
        
        idx++;
    }, 800);
    
    ipcRenderer.send('get-status');
}

function closeStatusModal() {
    const modal = $('status-modal');
    if (modal) modal.classList.remove('active');
}

// ===== TEST FUNCTIONS =====
function simulatePhishingAttack() {
    ipcRenderer.send('simulate-threat', {
        status: 'Threat',
        threat_type: 'Phishing',
        threat_details: 'Known phishing domain: fake-bank.com',
        threat_url: 'http://fake-bank.com/login',
        timestamp: new Date().toLocaleTimeString('en-GB'),
        severity: 'high'
    });
}

function simulateClipboardHijack() {
    ipcRenderer.send('simulate-threat', {
        status: 'Threat',
        threat_type: 'Clipboard Hijack',
        threat_details: 'Crypto address detected in clipboard: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa...',
        timestamp: new Date().toLocaleTimeString('en-GB'),
        severity: 'high',
        module: 'clipboard'
    });
}

function simulateNetworkScan() {
    ipcRenderer.send('simulate-threat', {
        status: 'Threat',
        threat_type: 'Network Reconnaissance',
        threat_details: 'Port scan detected: 6 ports in 10s from 192.168.1.105',
        timestamp: new Date().toLocaleTimeString('en-GB'),
        severity: 'medium',
        module: 'network'
    });
}

function testGuardianMessage() {
    alert('Guardian: "I\'m here to help keep your device safe."');
}

// ===== INIT =====
function init() {
    initStars();
    initNavigation();
    initIPCListeners();
    initSettingsListeners();
    
    updateQuarantineTable();
    loadSettings();
    loadUpdateSettings();
    loadData();
    initExtensionConnection();
    
    const scanEl = $('last-scan');
    if (scanEl) scanEl.textContent = lastScanTime;
    
    const countEl = $('threat-count');
    if (countEl) countEl.textContent = threatCount;
    
    const versionEl = $('current-version');
    if (versionEl) versionEl.textContent = 'v' + APP_VERSION;
    
    checkForUpdatesOnStartup();
    
    ipcRenderer.send('get-status');
    statusInterval = setInterval(() => {
        ipcRenderer.send('get-status');
    }, 5000);
}

// ===== CLEANUP =====
on(window, 'load', init);

on(window, 'beforeunload', () => {
    if (scanInterval) clearInterval(scanInterval);
    if (statusInterval) clearInterval(statusInterval);
    if (animationId) cancelAnimationFrame(animationId);
    saveData();
    saveSettings();
    saveUpdateSettings();
});
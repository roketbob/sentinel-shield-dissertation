const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow, pythonProcess, threatCount = 0;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Sentinel Shield'
    });
    mainWindow.loadFile('src/renderer/index.html');
    mainWindow.on('closed', () => { mainWindow = null; });
}

function startPython() {
    pythonProcess = spawn('python', ['src/main/security_engine.py']);
    
    pythonProcess.stdout.on('data', (data) => {
        try {
            const parsed = JSON.parse(data.toString().trim());
            if (mainWindow) {
                mainWindow.webContents.send('security-update', parsed);
                if (parsed.status === 'Threat') {
                    threatCount++;
                    mainWindow.webContents.send('threat-detected', parsed);
                }
            }
        } catch (e) {
            // Ignore non-JSON output
        }
    });
    
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
    });
}

ipcMain.on('get-status', (event) => {
    event.reply('security-update', {
        status: 'Protected',
        threats: threatCount,
        lastScan: new Date().toLocaleTimeString('en-GB')
    });
});

ipcMain.on('request-scan', (event) => {
    if (pythonProcess) {
        pythonProcess.stdin.write('scan\n');
    }
});

ipcMain.on('simulate-threat', (event, data) => {
    if (mainWindow) {
        mainWindow.webContents.send('threat-detected', data);
    }
});

// ===== BROWSER EXTENSION INTEGRATION =====
ipcMain.on('extension-message', (event, data) => {
    console.log('Message from extension:', data);
    
    if (data.type === 'threat_detected') {
        threatCount++;
        mainWindow.webContents.send('threat-detected', {
            status: 'Threat',
            threat_type: 'Browser Phishing',
            threat_details: data.reason,
            threat_url: data.url,
            timestamp: new Date().toLocaleTimeString('en-GB'),
            severity: data.severity || 'high',
            source: 'Browser Extension'
        });
    }
    
    if (data.type === 'get_stats') {
        event.reply('extension-stats', {
            threatsBlocked: threatCount,
            lastScan: new Date().toLocaleTimeString('en-GB')
        });
    }
});

app.whenReady().then(() => {
    createWindow();
    startPython();
});

app.on('window-all-closed', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
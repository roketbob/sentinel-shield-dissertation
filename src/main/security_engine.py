import time
import sys
import json
import re
import clipboard
from datetime import datetime
from collections import deque, Counter

# ===== PHISHING DETECTION =====
SUSPICIOUS_PATTERNS = [
    r'login.*secure', r'account.*verify', r'banking.*login',
    r'paypal.*secure', r'amazon.*account', r'microsoft.*verify'
]
KNOWN_PHISHING_DOMAINS = [
    'fake-bank.com', 'secure-login-verify.com', 'account-update-required.com',
    'paypal-security-check.com', 'amazon-account-locked.com'
]

def check_url_phishing(url):
    url_lower = url.lower()
    for domain in KNOWN_PHISHING_DOMAINS:
        if domain in url_lower:
            return True, f"Known phishing domain: {domain}"
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, url_lower):
            return True, f"Suspicious pattern: {pattern}"
    return False, None

# ===== CLIPBOARD PROTECTION =====
CRYPTO_PATTERNS = [
    r'^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$',
    r'^0x[a-fA-F0-9]{40}$',
    r'^[48][0-9]{18}$',
    r'^bc1[a-z0-9]{39,59}$'
]
last_clipboard = ""
clipboard_alerts = set()

def check_clipboard_hijack():
    global last_clipboard
    try:
        current = clipboard.paste().strip()
        if not current or current == last_clipboard:
            return False, None
        for pattern in CRYPTO_PATTERNS:
            if re.match(pattern, current):
                if current not in clipboard_alerts:
                    clipboard_alerts.add(current)
                    return True, f"Crypto address: {current[:20]}..."
        last_clipboard = current
        return False, None
    except:
        return False, None

# ===== NETWORK DETECTION =====
class NetworkMonitor:
    def __init__(self, window=20, time_win=10):
        self.log = deque(maxlen=window)
        self.time_win = time_win
        self.suspicious = {22, 23, 445, 3389, 5900, 1433, 3306}
    
    def add(self, ip, port, proto='TCP'):
        self.log.append({'ip': ip, 'port': port, 'proto': proto, 'time': datetime.now()})
    
    def detect_scan(self):
        if len(self.log) < 5:
            return False, None
        now = datetime.now()
        recent = [c for c in self.log if (now - c['time']).seconds <= self.time_win]
        if len(recent) < 5:
            return False, None
        ports = Counter((c['ip'], c['port']) for c in recent)
        unique = len(set(p for _, p in ports.keys()))
        susp = sum(1 for _, p in ports.keys() if p in self.suspicious)
        if unique >= 5 or susp >= 3:
            return True, f"Port scan: {unique} ports in {self.time_win}s"
        return False, None

net_mon = NetworkMonitor()

def simulate_network():
    import random
    ips = ['192.168.1.' + str(random.randint(1,254)) for _ in range(3)]
    ports = [22, 80, 443, 445, 3389, 8080, random.randint(1024,65535)]
    if random.random() < 0.05:  # Reduced from 0.1 to 0.05 (less frequent)
        for port in random.sample(ports, 6):
            net_mon.add(ips[0], port)
        return net_mon.detect_scan()
    net_mon.add(random.choice(ips), random.choice(ports))
    return False, None

# ===== FULL SCAN TRIGGER =====
def run_full_scan():
    """Executa todas as detecções durante Quick Scan"""
    threats = []
    
    # Phishing check
    is_phish, reason = check_url_phishing("http://fake-bank.com/login")
    if is_phish:
        threats.append({"type": "Phishing", "details": reason, "url": "http://fake-bank.com/login", "severity": "high"})
    
    # Clipboard check
    is_clip, reason = check_clipboard_hijack()
    if is_clip:
        threats.append({"type": "Clipboard Hijack", "details": reason, "severity": "high"})
    
    # Network check
    is_net, reason = simulate_network()
    if is_net:
        threats.append({"type": "Network Reconnaissance", "details": reason, "severity": "medium"})
    
    return threats

# ===== MAIN LOOP =====
def main():
    print("Sentinel Shield Security Engine Started...")
    print("Modules: Phishing | Clipboard | Network")
    print("Auto-scan: Reduced frequency (test buttons for demo)")
    print("-" * 50)
    
    count, threats = 0, 0
    last_scan_time = datetime.now().strftime("%H:%M:%S")
    
    while True:
        try:
            count += 1
            
            # Check for scan command from Electron
            command = sys.stdin.readline().strip() if sys.stdin.isatty() else ""
            
            if command == "scan":
                # FULL SCAN TRIGGERED
                print(json.dumps({"status": "Scanning", "message": "Full system scan initiated..."}))
                sys.stdout.flush()
                
                scan_threats = run_full_scan()
                for t in scan_threats:
                    threats += 1
                    print(json.dumps({
                        "status": "Threat", "threat_type": t["type"],
                        "threat_details": t["details"], "threat_url": t.get("url", "N/A"),
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "severity": t["severity"], "source": "QuickScan"
                    }))
                    sys.stdout.flush()
                
                last_scan_time = datetime.now().strftime("%H:%M:%S")
                print(json.dumps({"status": "ScanComplete", "threats_found": len(scan_threats), "last_scan": last_scan_time}))
                sys.stdout.flush()
                continue
            
            # Regular status update (every 5 seconds)
            status = {"status": "Protected", "threats": threats,
                     "last_scan": last_scan_time,
                     "modules": {"phishing": True, "clipboard": True, "network": True}}
            print(json.dumps(status))
            sys.stdout.flush()
            
            # Auto-checks (REDUCED FREQUENCY - only for demo purposes)
            if count % 30 == 0:  # Every 2.5 minutes (was 50 seconds)
                is_phish, reason = check_url_phishing("http://fake-bank.com/login")
                if is_phish:
                    threats += 1
                    print(json.dumps({"status": "Threat", "threat_type": "Phishing",
                                     "threat_details": reason, "threat_url": "http://fake-bank.com/login",
                                     "timestamp": datetime.now().strftime("%H:%M:%S"), "severity": "high", "source": "Auto"}))
                    sys.stdout.flush()
            
            time.sleep(5)
        except KeyboardInterrupt:
            print("\nSecurity Engine Stopped.")
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"status": "Error", "message": str(e)}))
            sys.stdout.flush()
            time.sleep(5)

if __name__ == "__main__":
    main()
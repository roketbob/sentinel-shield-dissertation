# 🛡️ Sentinel Shield

**A Real-Time, Offline Security Companion with Empathic Support**

## 📋 Project Overview

Sentinel Shield is an offline-first cybersecurity application that provides real-time threat detection with empathic, user-centred guidance for non-technical users.

## 🎓 Academic Information

- **Student:** Breno Castro
- **Student ID:** 2261404
- **Programme:** BSc (Hons) Computing Top-up
- **Module:** CMP600 – Dissertation
- **Institution:** Elizabeth School of London
- **Academic Year:** 2025-2026
- **Submission Date:** 22/05/2026

## 🚀 Features

- Real-time phishing detection
- Clipboard hijack protection
- Network reconnaissance detection
- Browser extension with cookie auto-reject
- Empathic Guardian Messages
- Fully offline operation
- Low resource usage (<100MB RAM)

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop UI | Electron.js |
| Backend | Python 3.11 |
| Browser Extension | JavaScript (Manifest V3) |
| Styling | CSS3 |
| Data Storage | localStorage |

## 📁 Project Structure
SentinelShield/
├── src/
│   ├── main/
│   │   ├── main.js
│   │   └── security_engine.py
│   ├── renderer/
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   └── assets/
├── sentinel-shield-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   └── popup.html
├── Evidence/
├── Documentation/
├── package.json
├── requirements.txt
└── README.md


 Installation

### Prerequisites
- Node.js 18+
- Python 3.11
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/SEU_USERNAME/sentinel-shield-dissertation.git

# Navigate to project directory
cd sentinel-shield-dissertation

# Install dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Run the application
npm start
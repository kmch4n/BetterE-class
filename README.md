# BetterE-class

**Chrome Extension for Doshisha University e-class**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** | [日本語](README_ja.md)

---

## 🎯 Overview

BetterE-class is a Chrome extension that enhances your experience on Doshisha University's e-class (WebClass). It provides convenient features such as viewing files directly in your browser without downloads, opening files in new tabs, and improving the message tool interface.

## ⚡ Features

* **📄 View Files Without Downloading**: Display report files directly in your browser
* **🆕 Open Files in New Tab**: Automatically display report files in a new tab (customizable in settings)
* **💬 Open Messages in Tab**: Open the message tool in a regular tab instead of a popup window
* **⚙️ Customizable**: Easily toggle features on/off from the popup
* **🔒 Secure**: Safe operation with a simple mechanism

## 📦 Installation

### For Users (Recommended)

1. Download the latest release from the [**Releases page**](https://github.com/kmch4n/BetterE-class/releases)
2. Extract the downloaded ZIP file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** by toggling the switch in the top right corner
5. Click **Load unpacked**
6. Select the extracted `extension` folder

### For Developers

```bash
git clone https://github.com/kmch4n/BetterE-class.git
cd BetterE-class
```

Then follow steps 3-6 from the "For Users" section above, selecting the `extension` folder.

### Configure Settings (Optional)

1. Click the extension icon in your toolbar
2. Toggle features on/off from the popup
   - **Open Files in New Tab**: Display report files in a new tab
   - **Open Messages in Tab**: Open message tool in a regular tab instead of popup

## 🚀 Usage

### Basic Usage

1. Log in to e-class
2. Open **My Reports** from a course page
3. Click on a file name
4. **The file will be displayed in a new tab** (no download required!)

### Customize Settings

Click the extension icon to change the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| **Open Files in New Tab** | Display report files in a new tab | On |
| **Open Messages in Tab** | Open message tool in a regular tab instead of popup window | On |

Settings are automatically saved and applied in real-time.

## ⚠️ Notes

- **Target**: Designed exclusively for Doshisha University's e-class system
- **Browser**: Works only with Chrome (Manifest V3)
- **Security**: This extension only manipulates HTTP headers and does not send or store any data
- **Disclaimer**: The author assumes no responsibility for any damages resulting from the use of this extension

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made by kmch4n**

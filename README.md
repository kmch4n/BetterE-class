# BetterE-class

**Chrome Extension for Doshisha University e-class**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Overview

BetterE-class is a Chrome extension that allows you to **view submitted report files directly in your browser without downloading** on Doshisha University's e-class (WebClass). Previously, you had to download files every time you wanted to check them, but with this extension, you can view them seamlessly in a new tab.

## ⚡ Features

* **📄 View Files Without Downloading**: Display report files directly in your browser
* **🆕 Open Files in New Tab**: Automatically display report files in a new tab (customizable in settings)
* **💬 Open Messages in Tab**: Open the message tool in a regular tab instead of a popup window
* **⚙️ Customizable**: Easily toggle features on/off from the popup
* **🔒 Secure**: Safe operation with a simple mechanism

## 📦 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/kmch4n/BetterE-class.git
cd BetterE-class
```

### Step 2: Load into Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** by toggling the switch in the top right corner
3. Click **Load unpacked**
4. Select the cloned folder

### Step 3: Configure Settings (Optional)

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

## 🤝 Contributing

Feel free to submit bug reports or feature requests via [Issues](https://github.com/kmch4n/BetterE-class/issues).

Pull requests are also welcome!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made by kmch4n**

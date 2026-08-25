# ⚖️ e-Metrology: The Complete Step-by-Step User Guide
### *National Unified Legal Metrology Instrument Verification & Digital Certification Platform*

---

> **Who is this guide for?**  
> Anyone! Whether you are a student, a shop owner, a government officer, or someone who has never touched a legal metrology app before, this guide explains **every single button, screen, and feature** in plain, simple language with zero confusion.

---

## 🌟 Table of Contents
1. [What is this App & Why Does it Exist?](#1-what-is-this-app--why-does-it-exist)
2. [How to Start & Open the App](#2-how-to-start--open-the-app)
3. [The Navigation Bar & Controls](#3-the-navigation-bar--controls)
4. [Walkthrough 1: The Trader's Journey (Shop Owner)](#4-walkthrough-1-the-traders-journey-shop-owner)
5. [Walkthrough 2: The Officer's Journey (Legal Metrology Officer)](#5-walkthrough-2-the-officers-journey-legal-metrology-officer)
6. [Walkthrough 3: The Supervisor's Dashboard (Executive Oversight)](#6-walkthrough-3-the-supervisors-dashboard-executive-oversight)
7. [Walkthrough 4: Public QR Code Verification (For Everyday Consumers)](#7-walkthrough-4-public-qr-code-verification-for-everyday-consumers)
8. [Walkthrough 5: GATC Centers & Historical Paper Migration](#8-walkthrough-5-gatc-centers--historical-paper-migration)
9. [Quick Cheat-Sheet & Troubleshooting FAQ](#9-quick-cheat-sheet--troubleshooting-faq)

---

## 1. What is this App & Why Does it Exist?

### The Real-World Problem 🍎
Whenever you buy apples from a grocery store, fill petrol in your scooter, or buy gold jewelry:
- How do you know that **1 kg of apples is actually 1 kg**?
- How do you know the **petrol pump meter is giving you full litres**?

In India, under **The Legal Metrology Act, 2009**, every commercial weighing scale and petrol pump must be officially inspected and certified by government officers.

### The Solution: e-Metrology 🚀
In the past, this was done using slow handwritten paper certificates that could be lost or forged.  
**e-Metrology** transforms the entire country's legal metrology into a high-tech, unified digital platform:
- **Shop Owners** can register scales, apply for verification, pay fees, and get digital certificates.
- **Government Officers (LMOs)** get automated math calculators to test weights down to decimal grams.
- **Consumers** can scan a tamper-proof QR code with their mobile phone to instantly see if a scale is authentic and legally verified!

---

## 2. How to Start & Open the App

You can launch both the backend server and frontend portal with a **single command**:

### Option 1: One-Click Python Runner (Recommended)
Open your terminal in the project folder and run:
```powershell
python run.py
```
*(Or double-click `run.bat` on Windows)*

> 🌟 **This automatically starts:**
> - **Backend API:** `http://127.0.0.1:8000` (FastAPI + SQLite + HSM Crypto)
> - **Frontend Portal:** `http://localhost:5173` (React 18 + Vite)
> - Press `Ctrl + C` anytime in that window to shut down both cleanly!

### Option 2: Manual Start (Two Separate Windows)

**Terminal 1 (Backend):**
```powershell
cd "c:\Users\as360\Desktop\sih weight\apps\verification-api"
python -m uvicorn app.main:app --port 8000 --reload
```

**Terminal 2 (Frontend):**
```powershell
cd "c:\Users\as360\Desktop\sih weight\apps\verification-web"
npm run dev
```

### Step 3: Open in Your Web Browser
Open Google Chrome, Microsoft Edge, or Firefox and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 3. The Navigation Bar & Controls

When you open the portal, look at the top header bar. Here is what each button does:

```
+--------------------------------------------------------------------------------------------------------------------+
|  🇮🇳 Government of India | Ministry of Consumer Affairs | Dept of Legal Metrology       Jurisdiction: NCT Delhi     |
+--------------------------------------------------------------------------------------------------------------------+
|  [⚖️ e-Metrology] [Trader Portal] [Officer Workspace] [Supervisor/SLA] [GATC] [Legacy] [QR]  [EN|हिन्दी] [MOCK] [Rajesh v]|
+--------------------------------------------------------------------------------------------------------------------+
```

1. **Brand Logo (`e-Metrology`)**: Clicking this always brings you back to your home dashboard.
2. **Language Switcher (`EN` | `हिन्दी`)**:
   - Click **`हिन्दी`** to switch the portal navigation into Hindi.
   - Click **`EN`** to switch back to English.
3. **Data Mode Toggle (`MOCK PREVIEW` vs `LIVE API: 8000`)**:
   - **MOCK PREVIEW (Amber)**: Runs offline with sample demo data instantly.
   - **LIVE API (Green)**: Connects directly to the real SQLite/PostgreSQL database on port 8000.
4. **Persona Switcher (`Rajesh • OWNER ▾`)**:
   - Click your name in the top right to switch between roles:
     - 🏪 **Trader / Instrument Owner** (Shop owner filing applications)
     - 👮‍♂️ **Legal Metrology Officer (LMO)** (Government inspector testing scales)
     - 👔 **Supervisor / Assistant Controller** (Boss monitoring state SLAs)
5. **Reset Demo DB (`🔄 Reset Demo DB`)**:
   - If you ever mess up demo test data, click this button to restore clean sample data in 1 second.

---

## 4. Walkthrough 1: The Trader's Journey (Shop Owner)

*Goal: Register a new weighing machine, apply for verification, pay fees, and view your verified certificate.*

### Step 4.1: Register a New Weighing Scale
1. Make sure you are in the **Trader Portal** (or switch persona to **Trader / Instrument Owner**).
2. Look at the top welcome banner and click the white button: **`+ Register Scale`**.
3. A popup form will appear:
   - **Instrument Category**: Select `Weighing Instrument (NAWI)`.
   - **Model**: Select `Eagle Pro Commercial Counter Scale (30 kg)`.
   - **Serial Number**: Type your machine's serial number (e.g., `SN-2026-DELHI-007`).
   - **Year of Manufacture**: Select `2024` or `2025`.
   - **Installation Location**: Type `Main Checkout Counter, Shop 4`.
4. Click **`Register Instrument`**.
5. 🎉 *Your machine is now registered in the National Registry!*

---

### Step 4.2: Apply for Verification (The Wizard)
1. In the Trader Portal banner, click the bright amber button: **`File Application`**.
2. A 4-step wizard will guide you:
   - **Step 1 (Select Instrument)**: Click on the scale you just registered.
   - **Step 2 (Verification Type & Location)**:
     - Verification Type: Choose `Periodic Re-Verification (Annual Renewal)`.
     - Inspection Mode: Choose `On-site at Trader Premises` or `At Departmental Lab`.
   - **Step 3 (Fee Assessment)**: The system automatically computes the official Schedule XII government fee (e.g. `₹750.00`).
   - **Step 4 (Legal Declaration)**: Tick the statutory declaration checkbox confirming the scale is in working order.
3. Click **`Submit Application`**.
4. 📄 *Your application is now officially submitted and queued for government scrutiny!*

---

### Step 4.3: Pay Statutory Fees & Download Receipt
1. Go to your **Active Applications & Timelines** list.
2. Find your application card. You will see an amber button: **`Pay Statutory Fee`**.
3. Click **`Pay Statutory Fee`**:
   - Choose payment mode: `UPI / NetBanking` or `Treasury Challan (e-GRAS / Bharatkosh)`.
   - Click **`Simulate Successful Payment`**.
4. A green **Payment Reconciled** badge will appear!
5. Click **`Download Receipt`** to view your official itemized treasury receipt with Transaction ID and GST details.

---

### Step 4.4: View & Print Your Green Digital Certificate
1. Once the officer completes the verification (see Walkthrough 2 below), your application status turns to **`COMPLETED`**.
2. Click **`View Certificate`** on the certificate card.
3. A popup will display your official **Form 8 Legal Metrology Verification Certificate**:
   - Official Ashoka Emblem & Government of India Header.
   - Certificate Number (e.g., `CERT-DL-2026-008912`).
   - Validity dates (Valid for 12 months).
   - Scannable dynamic QR Code.
   - Cryptographic SHA-256 digital signature digest badge.
4. Click **`Download PDF/A Certificate`** to save or print it for your shop counter!

---

## 5. Walkthrough 2: The Officer's Journey (Legal Metrology Officer)

*Goal: Scrutinize applications, run guided accuracy calculations, record physical lead seals, and digitally sign the certificate.*

### Step 5.1: Switch to Officer Workspace
1. In the top navbar, click **`Officer Workspace`** (or switch persona to `Legal Metrology Officer (LMO)`).
2. You will see three tabs:
   - 📋 **Scrutiny Queue**
   - 🔬 **Guided NAWI Testing**
   - 🛡️ **Physical Stamping Ledger**

---

### Step 5.2: Scrutinize an Application
1. Under **Scrutiny Queue**, you will see all applications submitted by traders.
2. Click on any application card to review:
   - If everything is correct: Click **`Accept Application`**.
   - If documents are missing: Click **`Raise Query`** (type your reason and the trader will get a query notice).
   - If ineligible: Click **`Reject Application`**.
3. Once accepted, the application moves to the **Testing Stage**.

---

### Step 5.3: Guided Metrological Testing (The 4 Accuracy Tests)
Click the **`Guided NAWI Testing`** sub-tab. The system guides you through the 4 mandatory Legal Metrology tests:

1. **Test 1: Zero Error ($E_0$)**:
   - Place zero load on the scale. Enter indicated reading (e.g., `0.000 kg`).
2. **Test 2: Increasing & Decreasing Load Steps**:
   - Place official Standard Weights (e.g. $5\text{ kg}$, $10\text{ kg}$, $20\text{ kg}$, $30\text{ kg}$).
   - Type the indicated value on screen.
   - 💡 *The app instantly calculates the Maximum Permissible Error (MPE) in real-time and shows a green `WITHIN MPE` or red `EXCEEDS MPE` badge!*
3. **Test 3: 5-Position Eccentricity (Corner Test)**:
   - Place a $10\text{ kg}$ weight in Center, Front-Left, Front-Right, Back-Left, and Back-Right.
   - Confirms the platter is accurate no matter where items are placed.
4. **Test 4: Repeatability Spread ($P_{\max} - P_{\min}$)**:
   - Apply the same $15\text{ kg}$ load 3 consecutive times to ensure consistency.

---

### Step 5.4: Record Physical Seals & Issue Certificate
1. Click **`Record Physical Stamps`**:
   - Enter the physical Lead Wire Seal or Hologram number (e.g., `SEAL-DL-2026-9941`).
   - Select seal placement (`Calibration Port Cover` and `Junction Box Screws`).
2. Click **`Authorize & Sign Certificate`**:
   - Enter your officer DSC PIN or cryptographic signing key.
   - Click **`Sign & Publish Certificate`**.
3. ✨ *The certificate is cryptographically stamped, immutable, and instantly searchable nationwide!*

---

## 6. Walkthrough 3: The Supervisor's Dashboard (Executive Oversight)

*Goal: Monitor state-wide verification backlogs, officer throughput, revenue collections, and security logs.*

1. In the top navbar, click **`Supervisor / SLA`** (or switch persona to `Assistant Controller / Supervisor`).
2. Explore the executive tabs:
   - 📊 **Overview Metrics**: Total instruments registered in the state, active certificates, and statutory treasury revenue.
   - ⏳ **Pendency Age Analysis**:
     - 🟢 `< 7 Days`: Fast turnaround (within citizen charter SLA).
     - 🟡 `7 - 15 Days`: Normal processing.
     - 🟠 `15 - 30 Days`: Attention required.
     - 🔴 `> 30 Days`: Red alert (SLA breach requiring escalation).
   - 👮 **Officer Throughput Table**: Shows inspections completed per officer, average turnaround days, and rejection ratios.
   - 🔒 **Security Audit Trail**: Append-only log of every single high-stakes action (logins, stamp assignments, certificate supersessions, payments).

---

## 7. Walkthrough 4: Public QR Code Verification (For Everyday Consumers)

*Goal: Verify if any shopkeeper's certificate or scale is authentic without needing an account.*

1. In the top navbar, click **`Public QR Verify`** (or navigate to `http://localhost:5173/#/verify/TOKEN_VALID_2026`).
2. You will see the **Public Certificate Authenticity Portal**:
   - **Verification Token Box**: Type or paste any certificate token (e.g., `TOKEN_VALID_2026`).
   - Click **`Verify Certificate`**.
3. What the screen shows:
   - 🟢 **Status**: `VERIFIED & ACTIVE (ISSUED)`
   - 📜 **Certificate Number**: `CERT-DL-2026-008912`
   - 📅 **Validity**: Valid until 2027
   - ⚖️ **Scale Type**: Electronic Counter Scale (Class III, 30 kg max)
   - 🔢 **Masked Serial**: `SN-****-9941` *(Privacy protected)*
   - 🔐 **Cryptographic SHA-256 Digest**: `e3b0c44298fc1c149...`
4. 🛡️ **Zero-PII Privacy Protection**:
   - Notice that personal phone numbers, bank accounts, and exact trader addresses are **never** shown to public users, protecting citizen privacy while guaranteeing absolute legal authenticity!

---

## 8. Walkthrough 5: GATC Centers & Historical Paper Migration

### 8.1 GATC Centers Tab (`GATC Centers`)
- **Government Approved Test Centers (GATCs)** are authorized third-party laboratories.
- Use this tab to inspect accredited private test centers, view their approved verification scope (e.g. Class I analytical micro-balances vs Class III weighbridges), and check standard weight calibration expiry dates.

### 8.2 Legacy Migration Console (`Legacy Migration`)
- Allows departmental clerks to upload old paper registers via bulk CSV files.
- Automatically validates serial duplicates, checks for missing data, and assigns a provenance trust level:
  - `Verified Legacy`
  - `Digitized from Source`
  - `Unverified Legacy`

---

## 9. Quick Cheat-Sheet & Troubleshooting FAQ

### Quick Cheat-Sheet

| What do you want to do? | Where to click? | Button to press |
| :--- | :--- | :--- |
| **Register a new scale** | `Trader Portal` | `+ Register Scale` |
| **Apply for verification** | `Trader Portal` | `File Application` |
| **Pay government fee** | `Trader Portal` $\to$ `Active Applications` | `Pay Statutory Fee` |
| **Print certificate** | `Trader Portal` $\to$ `Applications` | `View Certificate` $\to$ `Download PDF` |
| **Inspect a scale (Officer)** | `Officer Workspace` $\to$ `NAWI Testing` | `Calculate MPE` $\to$ `Authorize Certificate` |
| **Check overdue delays** | `Supervisor / SLA` | `Pendency Analysis` |
| **Scan QR code** | `Public QR Verify` | `Verify Certificate` |
| **Switch to Hindi** | Top Right Header | Click `हिन्दी` |

---

### Frequently Asked Questions (FAQ)

#### Q1: "I get an error saying 'Cannot connect to API' or '401 Unauthorized'?"
👉 **Fix**: In the top right header, check the mode button. If your Python backend is not running, click **`MOCK PREVIEW`** to use the instant built-in offline simulator. If running the backend, make sure `uvicorn app.main:app --port 8000` is running in your terminal.

#### Q2: "Can I test expired certificates or suspended instruments?"
👉 **Yes!** Go to the `Public QR Verify` page and try entering:
- `TOKEN_EXPIRED_DEMO` $\to$ Shows red **EXPIRED** alert.
- `TOKEN_REVOKED_DEMO` $\to$ Shows red **REVOKED & SEIZED** notice.

#### Q3: "How do I reset all test data back to clean defaults?"
👉 Click the **`Reset Demo DB`** button in the top grey ministry banner. It resets all sample instruments, applications, and test records in 1 second.

---

*⚖️ Platform engineered under the statutory mandate of The Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011.*

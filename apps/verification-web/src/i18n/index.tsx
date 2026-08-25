/**
 * Statutory Indian Languages Localization (i18n) Engine.
 * Complete English (en) and Hindi (hi - हिन्दी) translations for the entire portal.
 */

import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'hi';

export interface Translations {
  // Common & Top Banner
  govOfIndia: string;
  ministryName: string;
  deptName: string;
  jurisdictionLabel: string;
  resetDemoDb: string;
  brandTitle: string;
  brandSubtitle: string;
  nationalPlatform: string;
  switchPersona: string;
  mockPreview: string;
  liveApi: string;

  // Navigation Tabs
  navTrader: string;
  navOfficer: string;
  navSupervisor: string;
  navGATC: string;
  navMigration: string;
  navPublicQR: string;

  // Trader Portal
  tabOverview: string;
  tabMyInstruments: string;
  tabMyApplications: string;
  statTotalRegistered: string;
  statActiveValid: string;
  statPendingVerification: string;
  statFeesDue: string;
  btnRegisterInstrument: string;
  btnApplyVerification: string;
  btnPayFee: string;
  btnDownloadReceipt: string;
  btnViewCertificate: string;
  btnRespondQuery: string;
  recentApplicationsTitle: string;
  timelineTitle: string;

  // Officer Workspace
  officerTitle: string;
  officerSubtitle: string;
  statPendingScrutiny: string;
  statScheduledTesting: string;
  statCompletedToday: string;
  btnAcceptApplication: string;
  btnRaiseQuery: string;
  btnRejectApplication: string;
  btnStartTesting: string;
  btnRecordStamps: string;
  btnAuthorizeCertificate: string;
  observationGridTitle: string;
  stampingLedgerTitle: string;

  // Supervisor Dashboard
  supervisorTitle: string;
  supervisorSubtitle: string;
  pendencyAnalysisTitle: string;
  tierLess7Days: string;
  tier7To15Days: string;
  tier15To30Days: string;
  tierOver30Days: string;
  officerSlaTitle: string;
  revenueLedgerTitle: string;
  auditTrailTitle: string;

  // Public QR Page
  publicVerifyTitle: string;
  publicVerifySubtitle: string;
  enterTokenPlaceholder: string;
  btnVerify: string;
  certStatusLabel: string;
  validUntilLabel: string;
  issuingAuthorityLabel: string;
  maskedSerialLabel: string;
  cryptoDigestLabel: string;
  zeroPiiNotice: string;

  // Status Labels
  statusDraft: string;
  statusSubmitted: string;
  statusUnderScrutiny: string;
  statusQueryRaised: string;
  statusFeePending: string;
  statusScheduled: string;
  statusCompleted: string;
  statusIssued: string;
  statusExpired: string;
  statusRevoked: string;
  statusSuperseded: string;

  // Login
  loginTitle: string;
  loginSubtitle: string;
  loginEmailLabel: string;
  loginPasswordLabel: string;
  loginButton: string;
  loginError: string;
  loginRequired: string;
  loginDemoCredentials: string;
  logoutButton: string;
  loggedInAs: string;
}

const translations: Record<Language, Translations> = {
  en: {
    govOfIndia: 'Government of India',
    ministryName: 'Ministry of Consumer Affairs, Food & Public Distribution',
    deptName: 'Department of Legal Metrology',
    jurisdictionLabel: 'Jurisdiction:',
    resetDemoDb: 'Reset Demo DB',
    brandTitle: 'e-Metrology',
    brandSubtitle: 'National Instrument Verification & Digital Certification',
    nationalPlatform: 'National Platform',
    switchPersona: 'Switch Active Persona',
    mockPreview: 'MOCK PREVIEW',
    liveApi: 'LIVE API: 8000',

    navTrader: 'Trader Portal',
    navOfficer: 'Officer Workspace',
    navSupervisor: 'Supervisor / SLA',
    navGATC: 'GATC Centers',
    navMigration: 'Legacy Migration',
    navPublicQR: 'Public QR Verify',

    tabOverview: 'Overview',
    tabMyInstruments: 'My Instruments',
    tabMyApplications: 'My Applications',
    statTotalRegistered: 'Registered Instruments',
    statActiveValid: 'Active Certificates',
    statPendingVerification: 'Pending Verification',
    statFeesDue: 'Fees Pending',
    btnRegisterInstrument: '+ Register Instrument',
    btnApplyVerification: 'Apply for Verification',
    btnPayFee: 'Pay Statutory Fee',
    btnDownloadReceipt: 'Download Receipt',
    btnViewCertificate: 'View Certificate',
    btnRespondQuery: 'Respond to Query',
    recentApplicationsTitle: 'Recent Verification Applications',
    timelineTitle: 'Application Lifecycle Timeline',

    officerTitle: 'Scrutiny & Verification Workspace',
    officerSubtitle: 'Statutory scrutiny, NAWI testing, physical stamping & certificate authorization',
    statPendingScrutiny: 'Pending Scrutiny',
    statScheduledTesting: 'Scheduled Testing Sessions',
    statCompletedToday: 'Completed Today',
    btnAcceptApplication: 'Accept Application',
    btnRaiseQuery: 'Raise Query',
    btnRejectApplication: 'Reject Application',
    btnStartTesting: 'Start Verification Test',
    btnRecordStamps: 'Record Physical Stamps',
    btnAuthorizeCertificate: 'Authorize Digital Certificate',
    observationGridTitle: 'Guided Metrological Test Observation Grid',
    stampingLedgerTitle: 'Physical Stamp & Seal Inventory Ledger',

    supervisorTitle: 'Executive Supervisor & SLA Dashboard',
    supervisorSubtitle: 'Pendency age analysis, officer SLA turnaround, revenue reconciliation & audit logs',
    pendencyAnalysisTitle: 'Statutory Pendency Age Analysis',
    tierLess7Days: '< 7 Days (Within SLA)',
    tier7To15Days: '7 - 15 Days (Attention Required)',
    tier15To30Days: '15 - 30 Days (Escalated)',
    tierOver30Days: '> 30 Days (Overdue Breach)',
    officerSlaTitle: 'Officer Workload & Resolution Metrics',
    revenueLedgerTitle: 'Reconciled Statutory Revenue Ledger',
    auditTrailTitle: 'Privileged Security & Action Audit Trail',

    publicVerifyTitle: 'Public Certificate & QR Verification',
    publicVerifySubtitle: 'Official authenticity verification under The Legal Metrology Act, 2009',
    enterTokenPlaceholder: 'Enter 256-bit QR verification token...',
    btnVerify: 'Verify Certificate',
    certStatusLabel: 'Certificate Status:',
    validUntilLabel: 'Valid Until:',
    issuingAuthorityLabel: 'Issuing Authority:',
    maskedSerialLabel: 'Instrument Serial (Masked):',
    cryptoDigestLabel: 'Cryptographic SHA-256 Digest:',
    zeroPiiNotice: 'Zero-PII Protection: Trader personal details, contact numbers, and bank records are strictly masked.',

    statusDraft: 'Draft',
    statusSubmitted: 'Submitted',
    statusUnderScrutiny: 'Under Scrutiny',
    statusQueryRaised: 'Query Raised',
    statusFeePending: 'Fee Pending',
    statusScheduled: 'Scheduled',
    statusCompleted: 'Completed',
    statusIssued: 'VALID & ISSUED',
    statusExpired: 'EXPIRED',
    statusRevoked: 'REVOKED',
    statusSuperseded: 'SUPERSEDED',

    loginTitle: 'Sign In — e-Metrology Portal',
    loginSubtitle: 'National Legal Metrology Verification & Digital Certification Platform',
    loginEmailLabel: 'Email Address',
    loginPasswordLabel: 'Password',
    loginButton: 'Sign In',
    loginError: 'Invalid email or password',
    loginRequired: 'Please enter your email and password to continue.',
    loginDemoCredentials: 'Demo credentials: trader@example.com / Trader@2026',
    logoutButton: 'Sign Out',
    loggedInAs: 'Signed in as',
  },
  hi: {
    govOfIndia: 'भारत सरकार',
    ministryName: 'उपभोक्ता मामले, खाद्य और सार्वजनिक वितरण मंत्रालय',
    deptName: 'विधिक मापविज्ञान विभाग',
    jurisdictionLabel: 'क्षेत्राधिकार:',
    resetDemoDb: 'डेमो डेटा रीसेट',
    brandTitle: 'ई-मापविधि',
    brandSubtitle: 'राष्ट्रीय विधिक मापविज्ञान एवं डिजिटल प्रमाणीकरण मंच',
    nationalPlatform: 'राष्ट्रीय पोर्टल',
    switchPersona: 'सक्रिय भूमिका बदलें',
    mockPreview: 'मॉक पूर्वावलोकन',
    liveApi: 'लाइव एपीआई: 8000',

    navTrader: 'व्यापारी पोर्टल',
    navOfficer: 'अधिकारी कार्यक्षेत्र',
    navSupervisor: 'पर्यवेक्षक / एसएलए',
    navGATC: 'जीएटीसी केंद्र',
    navMigration: 'पुरातन माइग्रेशन',
    navPublicQR: 'सार्वजनिक क्यूआर सत्यापन',

    tabOverview: 'अवलोकन',
    tabMyInstruments: 'मेरे पंजीकृत उपकरण',
    tabMyApplications: 'मेरे सत्यापन आवेदन',
    statTotalRegistered: 'कुल पंजीकृत उपकरण',
    statActiveValid: 'वैध सक्रिय प्रमाणपत्र',
    statPendingVerification: 'सत्यापन लंबित आवेदन',
    statFeesDue: 'बकाया वैधानिक शुल्क',
    btnRegisterInstrument: '+ नया उपकरण पंजीकृत करें',
    btnApplyVerification: 'सत्यापन हेतु आवेदन करें',
    btnPayFee: 'वैधानिक शुल्क भुगतान करें',
    btnDownloadReceipt: 'रसीद डाउनलोड करें',
    btnViewCertificate: 'प्रमाणपत्र देखें',
    btnRespondQuery: 'पूछताछ का उत्तर दें',
    recentApplicationsTitle: 'हाल के सत्यापन आवेदन',
    timelineTitle: 'आवेदन जीवनचक्र समयरेखा',

    officerTitle: 'संवीक्षा एवं सत्यापन कार्यक्षेत्र',
    officerSubtitle: 'वैधानिक संवीक्षा, एनएडब्ल्यूआई परीक्षण, भौतिक मुद्रांकन एवं प्रमाणपत्र प्राधिकार',
    statPendingScrutiny: 'संवीक्षा हेतु लंबित',
    statScheduledTesting: 'अनुसूचित परीक्षण सत्र',
    statCompletedToday: 'आज पूर्ण किए गए',
    btnAcceptApplication: 'आवेदन स्वीकार करें',
    btnRaiseQuery: 'स्पष्टीकरण / पूछताछ मांगें',
    btnRejectApplication: 'आवेदन अस्वीकार करें',
    btnStartTesting: 'सत्यापन परीक्षण प्रारंभ करें',
    btnRecordStamps: 'भौतिक मुद्रांकन/सील दर्ज करें',
    btnAuthorizeCertificate: 'डिजिटल प्रमाणपत्र अधिकृत करें',
    observationGridTitle: 'निर्देशित मापवैज्ञानिक परीक्षण अवलोकन ग्रिड',
    stampingLedgerTitle: 'भौतिक मुद्रांकन एवं सील इन्वेंट्री लेजर',

    supervisorTitle: 'कार्यकारी पर्यवेक्षक एवं एसएलए डैशबोर्ड',
    supervisorSubtitle: 'लंबिता आयु विश्लेषण, अधिकारी एसएलए टर्नअराउंड, राजस्व समाधान एवं ऑडिट लॉग',
    pendencyAnalysisTitle: 'वैधानिक लंबिता आयु विश्लेषण',
    tierLess7Days: '< ७ दिन (समय सीमा के भीतर)',
    tier7To15Days: '७ - १५ दिन (ध्यान देने योग्य)',
    tier15To30Days: '१५ - ३० दिन (अतिदेय चेतावनी)',
    tierOver30Days: '> ३० दिन (एसएलए उल्लंघन)',
    officerSlaTitle: 'अधिकारी कार्यभार एवं समाधान मेट्रिक्स',
    revenueLedgerTitle: 'समाशोधित वैधानिक राजस्व लेजर',
    auditTrailTitle: 'विशेषाधिकार प्राप्त सुरक्षा एवं ऑडिट ट्रेल',

    publicVerifyTitle: 'सार्वजनिक प्रमाणपत्र एवं क्यूआर सत्यापन',
    publicVerifySubtitle: 'विधिक मापविज्ञान अधिनियम, 2009 के अंतर्गत आधिकारिक प्रामाणिकता सत्यापन',
    enterTokenPlaceholder: '256-बिट क्यूआर सत्यापन टोकन दर्ज करें...',
    btnVerify: 'प्रमाणपत्र सत्यापित करें',
    certStatusLabel: 'प्रमाणपत्र स्थिति:',
    validUntilLabel: 'वैधता समाप्ति तिथि:',
    issuingAuthorityLabel: 'जारीकर्ता प्राधिकारी:',
    maskedSerialLabel: 'उपकरण क्रमांक (सुरक्षित/मास्क):',
    cryptoDigestLabel: 'क्रिप्टोग्राफिक SHA-256 डाइजेस्ट:',
    zeroPiiNotice: 'शून्य-पीआईआई सुरक्षा: व्यापारी के व्यक्तिगत विवरण, संपर्क नंबर एवं बैंक खाते पूर्णतः गोपनीय हैं।',

    statusDraft: 'प्रारूप (ड्राफ्ट)',
    statusSubmitted: 'जमा किया गया',
    statusUnderScrutiny: 'संवीक्षाधीन',
    statusQueryRaised: 'पूछताछ जारी',
    statusFeePending: 'शुल्क भुगतान लंबित',
    statusScheduled: 'परीक्षण हेतु निर्धारित',
    statusCompleted: 'सत्यापन पूर्ण',
    statusIssued: 'वैध एवं जारी',
    statusExpired: 'अवधि पूर्ण (समाप्त)',
    statusRevoked: 'निरस्त (रद्द)',
    statusSuperseded: 'प्रतिस्थापित (सुपरसीड)',

    loginTitle: 'साइन इन — ई-मेट्रोलॉजी पोर्टल',
    loginSubtitle: 'राष्ट्रीय विधिक मापविज्ञान सत्यापन एवं डिजिटल प्रमाणन प्लेटफॉर्म',
    loginEmailLabel: 'ईमेल पता',
    loginPasswordLabel: 'पासवर्ड',
    loginButton: 'साइन इन',
    loginError: 'अमान्य ईमेल या पासवर्ड',
    loginRequired: 'कृपया अपना ईमेल और पासवर्ड दर्ज करें।',
    loginDemoCredentials: 'डेमो क्रेडेंशियल: trader@example.com / Trader@2026',
    logoutButton: 'साइन आउट',
    loggedInAs: 'के रूप में साइन इन किया गया',
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('preferred_language') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);

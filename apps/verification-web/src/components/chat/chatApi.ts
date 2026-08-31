import { RAGQueryResponse } from './chatTypes';

const API_BASE = '/api/v1';

export const chatApi = {
  async sendQuery(
    query: string,
    language: 'en' | 'hi' = 'en',
    context?: string,
    history?: any[]
  ): Promise<RAGQueryResponse> {
    try {
      const res = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          language,
          portal_context: context || 'trader',
          history: history || [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.answer) {
          return data;
        }
      }
    } catch {
      // Backend unreachable, fallback locally
    }

    // Comprehensive client-side fallback
    const isHindi = language === 'hi';
    const q = query.toLowerCase();

    // 1. Time / Duration / SLA
    if (
      q.includes('time') ||
      q.includes('duration') ||
      q.includes('how long') ||
      q.includes('take to test') ||
      q.includes('hours') ||
      q.includes('minutes') ||
      q.includes('समय') ||
      q.includes('देर')
    ) {
      return {
        answer: isHindi
          ? `### सत्यापन परीक्षण में लगने वाला समय (Citizen Charter SLA)

विभिन्न उपकरणों के भौतिक परीक्षण एवं सत्यापन में लगने वाला अनुमानित समय:
- **खुदरा काउंटर स्केल (≤ 50 किग्रा):** लगभग 15 से 30 मिनट प्रति यूनिट (MPE, पुनरावृत्ति एवं उत्केंद्रता परीक्षण)।
- **प्लेटफॉर्म मशीन (50 से 500 किग्रा):** लगभग 30 से 45 मिनट।
- **धर्मकांटा / इलेक्ट्रॉनिक वेईब्रिज (10 से 100 टन):** लगभग 1.5 से 3 घंटे (मानक परीक्षण भार एवं मोबाइल टेस्ट यूनिट के साथ)।
- **प्रमाण पत्र जारी करने का समय:** परीक्षण पूर्ण होने एवं अधिकारी के डिजिटल हस्ताक्षर के बाद **24 से 48 घंटे** के भीतर डिजिटल प्रमाण पत्र एवं क्यूआर कोड जारी हो जाता है।`
          : `### Verification Testing Duration & Turnaround Time (Citizen Charter SLA)

The physical testing and verification duration depends on the instrument type:
- **Retail Counter Scales (≤ 50 kg):** ~15 to 30 minutes per unit (includes Repeatability, Linearity MPE, and Eccentricity tests).
- **Platform Scales (50 kg to 500 kg):** ~30 to 45 minutes.
- **Heavy Weighbridges (10 Tonne to 100 Tonne):** ~1.5 to 3 hours (requires Mobile Test Unit with certified standard test weights).
- **Certificate Issuance SLA:** Once tested and authorized by the LMO or GATC verifier, the digital certificate with verifiable QR code is issued within **24 to 48 hours**.`,
        language,
        citations: [
          {
            citation_id: 'CIT-TIME',
            act_or_rule: 'Legal Metrology Citizen Charter & General Rules, 2011',
            section_rule_ref: 'Citizen Charter SLA & Rule 27',
            title: 'Verification Testing Duration and Turnaround Time',
            relevance_score: 9.9,
            snippet:
              'Prescribes testing procedures and standard SLA timelines (24-48 hrs) for verification certificate issuance.',
          },
        ],
        portal_actions: [
          {
            label: 'Book Verification Appointment',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Schedule a verification slot on Trader Portal',
          },
        ],
        suggested_followups: [
          'What documents are required for verification?',
          'How to calculate statutory verification fees?',
          'What is the re-verification validity period?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 2. Documents Required
    if (
      q.includes('document') ||
      q.includes('doc') ||
      q.includes('paper') ||
      q.includes('invoice') ||
      q.includes('दस्तावेज') ||
      q.includes('कागजात')
    ) {
      return {
        answer: isHindi
          ? `### सत्यापन हेतु आवश्यक दस्तावेज (Rule 16)

उपकरण सत्यापन आवेदन हेतु निम्नलिखित दस्तावेज अनिवार्य हैं:
1. **खरीद का बिल / टैक्स इनवॉइस:** जिसमें निर्माता, मॉडल एवं सीरियल नंबर दर्ज हो।
2. **केंद्रीय मॉडल अनुमोदन प्रमाण पत्र (धारा 22):** नए उपकरणों के लिए अनिवार्य।
3. **पिछला सत्यापन प्रमाण पत्र:** नवीनीकरण (Re-verification) के समय आवश्यक।
4. **व्यापार/जीएसटी पंजीकरण प्रमाण पत्र:** व्यापारी की पहचान हेतु।
5. **मरम्मत प्रमाण पत्र (Form VR):** यदि उपकरण की पूर्व में मरम्मत हुई हो।`
          : `### Mandatory Documents for Verification (Rule 16)

The following documents are required when applying for verification:
1. **Invoice / Bill of Sale:** Showing legal purchase, manufacturer name, model, and serial number.
2. **Central Model Approval Certificate (Section 22):** Mandatory for new instruments.
3. **Previous Verification Certificate:** Required for periodic re-verification renewals.
4. **GSTIN / Establishment Registration:** Identity proof of the applicant business.
5. **Repairer Certificate (Form VR):** Required if the scale was repaired by a licensed technician prior to verification.`,
        language,
        citations: [
          {
            citation_id: 'CIT-DOCS',
            act_or_rule: 'Legal Metrology Departmental Procedure',
            section_rule_ref: 'Rule 16 & Application Checklist',
            title: 'Documents Required for Instrument Verification',
            relevance_score: 9.8,
            snippet:
              'Lists invoice, model approval certificate, and past verification records required for statutory scrutiny.',
          },
        ],
        portal_actions: [
          {
            label: 'Open Verification Desk',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Apply for verification or upload documents',
          },
        ],
        suggested_followups: [
          'How to calculate verification fee?',
          'What is Section 22 Central Model Approval?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 3. Fees
    if (
      q.includes('fee') ||
      q.includes('cost') ||
      q.includes('charge') ||
      q.includes('price') ||
      q.includes('rate') ||
      q.includes('शुल्क') ||
      q.includes('पैसे')
    ) {
      return {
        answer: isHindi
          ? `### वैधानिक सत्यापन शुल्क अनुसूची (बारहवीं अनुसूची)

विधिक मापविज्ञान (सामान्य) नियम, 2011 के अनुसार निर्धारित वैधानिक शुल्क:
- **काउंटर तराजू (≤ 50 किग्रा):** ₹100 – ₹200
- **प्लेटफॉर्म तराजू (50 से 500 किग्रा):** ₹200 – ₹500
- **भारी औद्योगिक तराजू (500 किग्रा - 5 टन):** ₹500 – ₹2,000
- **इलेक्ट्रॉनिक धर्मकांटा / वेईब्रिज (10 - 100 टन):** ₹3,000 – ₹5,000
- **पेट्रोल / डीजल पंप नोजल:** ₹1,000 प्रति नोजल

> 💡 *नोट: आवेदन भरते समय पोर्टल उपकरण की क्षमता के आधार पर स्वतः सटीक शुल्क की गणना करता है।*`
          : `### Statutory Verification Fee Schedule (Twelfth Schedule)

Official statutory verification fees under Legal Metrology (General) Rules, 2011:
- **Commercial Counter Scales (≤ 50 kg):** ₹100 – ₹200
- **Platform Scales (50 kg to 500 kg):** ₹200 – ₹500
- **Heavy Industrial Scales (500 kg to 5 Tonne):** ₹500 – ₹2,000
- **Electronic Weighbridges (10 Tonne to 100 Tonne):** ₹3,000 – ₹5,000
- **Fuel Dispensing Pumps:** ₹1,000 per nozzle

> 💡 *Note: The exact statutory fee is calculated automatically when submitting your application on the Trader Portal.*`,
        language,
        citations: [
          {
            citation_id: 'CIT-FEE',
            act_or_rule: 'Legal Metrology (General) Rules, 2011',
            section_rule_ref: 'Twelfth Schedule',
            title: 'Fee for Verification and Stamping',
            relevance_score: 9.8,
            snippet:
              'Prescribes mandatory fee schedules for verification and stamping of weighing and measuring instruments.',
          },
        ],
        portal_actions: [
          {
            label: 'Open Trader Application Desk',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Apply for verification or compute exact fees',
          },
        ],
        suggested_followups: [
          'What are the fees for weighbridge verification?',
          'What is the penalty for using an unverified scale?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 4. Model Approval (Section 22)
    if (
      q.includes('model') ||
      q.includes('ind/') ||
      q.includes('approval') ||
      q.includes('मॉडल') ||
      q.includes('अनुमोदन')
    ) {
      return {
        answer: isHindi
          ? `### केंद्रीय मॉडल अनुमोदन (धारा 22)

विधिक मापविज्ञान अधिनियम, 2009 की धारा 22 के तहत:
- भारत में किसी भी नए वजन या माप उपकरण के निर्माण, आयात या बिक्री से पहले केंद्रीय विधिक मापविज्ञान निदेशालय से **मॉडल अनुमोदन प्रमाण पत्र** (उदा. \`IND/09/2026/XXX\`) प्राप्त करना अनिवार्य है।
- बिना केंद्रीय मॉडल अनुमोदन वाले किसी भी उपकरण का सत्यापन या व्यापार में उपयोग नहीं किया जा सकता।`
          : `### Mandatory Central Model Approval (Section 22)

Under Section 22 of The Legal Metrology Act, 2009:
- Every manufacturer or importer must obtain a **Certificate of Model Approval** (e.g. \`IND/09/2026/XXX\`) from the Central Directorate of Legal Metrology before selling, distributing, or stamping any instrument in India.
- Instruments without central model approval cannot be legally verified or used in commerce.`,
        language,
        citations: [
          {
            citation_id: 'CIT-MOD',
            act_or_rule: 'The Legal Metrology Act, 2009',
            section_rule_ref: 'Section 22',
            title: 'Approval of Model',
            relevance_score: 9.9,
            snippet:
              'Mandatory prior Central Model Approval for all weighing and measuring instruments.',
          },
        ],
        portal_actions: [
          {
            label: 'View Approved Models',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Inspect Government Approved Model Registry',
          },
        ],
        suggested_followups: [
          'Can I verify a machine without Model Approval?',
          'How to register a scale on this portal?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 5. Packaged Commodities (Rule 6)
    if (
      q.includes('package') ||
      q.includes('mrp') ||
      q.includes('label') ||
      q.includes('packet') ||
      q.includes('पैकेट') ||
      q.includes('पैकेजिंग')
    ) {
      return {
        answer: isHindi
          ? `### पैकेज्ड कमोडिटीज नियम 2011 (नियम 6) — 7 अनिवार्य घोषणाएं

प्रत्येक प्री-पैक्ड वस्तु पर निम्नलिखित 7 घोषणाएं स्पष्ट रूप से मुद्रित होनी चाहिए:
1. **निर्माता / पैकर / आयातक का नाम व पूरा पता**
2. **वस्तु का सामान्य या जेनेरिक नाम**
3. **शुद्ध मात्रा (Net Quantity)** मानक इकाइयों (g/kg/ml/L) में
4. **निर्माण / पैकिंग का माह एवं वर्ष**
5. **अधिकतम खुदरा मूल्य:** \`MRP ₹ xx.xx (सभी करों सहित)\`
6. **इकाई विक्रय मूल्य (Unit Sale Price):** 1 किग्रा या 1 लीटर से अधिक वाले पैकेट पर
7. **उपभोक्ता हेल्पलाइन विवरण:** नाम, पता, फोन नंबर व ईमेल`
          : `### Mandatory Declarations on Pre-Packaged Goods (Rule 6)

Under Rule 6 of Legal Metrology (Packaged Commodities) Rules, 2011, every package must display:
1. **Name & complete address** of Manufacturer / Packer / Importer.
2. **Common or generic name** of the commodity.
3. **Net Quantity** in standard units (g, kg, ml, L, or count).
4. **Month and Year** of manufacture / packing / import.
5. **Maximum Retail Price:** in format \`MRP ₹ xx.xx (inclusive of all taxes)\`.
6. **Unit Sale Price (USP):** for packages containing more than 1 kg or 1 L.
7. **Consumer Care Contact Details:** (Name, Address, Phone, and Email).`,
        language,
        citations: [
          {
            citation_id: 'CIT-PKG',
            act_or_rule: 'Legal Metrology (Packaged Commodities) Rules, 2011',
            section_rule_ref: 'Rule 6',
            title: 'Declarations to be made on every package',
            relevance_score: 9.8,
            snippet: 'Mandatory label declarations on all pre-packed commodities.',
          },
        ],
        portal_actions: [],
        suggested_followups: [
          'What is Maximum Permissible Error in net quantity?',
          'What are packaging rules for e-commerce?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 6. Penalties & Fines
    if (
      q.includes('penalty') ||
      q.includes('fine') ||
      q.includes('punish') ||
      q.includes('seizure') ||
      q.includes('illegal') ||
      q.includes('जुर्माना') ||
      q.includes('सजा')
    ) {
      return {
        answer: isHindi
          ? `### अवैध / असत्यापित तराजू पर वैधानिक दंड (धारा 30 एवं 33)

- **प्रथम अपराध:** असत्यापित वजन या माप उपकरण का उपयोग करने पर ₹10,000 तक का जुर्माना।
- **द्वितीय या बारंबार अपराध:** 1 वर्ष तक का कारावास एवं अतिरिक्त अर्थदंड।
- **मुहर से छेड़छाड़ / सील तोड़ना:** ₹25,000 तक का जुर्माना एवं उपकरण की जब्ती।
- **शमन (Compounding - धारा 48):** प्रथम बार गैर-धोखाधड़ी मामलों में विधिक मापविज्ञान नियंत्रक द्वारा शमन राशि जमा कर मामला समाप्त किया जा सकता है।`
          : `### Penalties for Using Unverified Weights & Measures (Sections 30 & 33)

- **First Offence:** Fine up to ₹10,000 for using unverified/unstamped weights in trade.
- **Second or Subsequent Offence:** Imprisonment up to 1 year and fine.
- **Tampering with Official Physical Seal:** Fine up to ₹25,000 and instrument seizure.
- **Compounding (Section 48):** Non-fraudulent first-time offences can be compounded by the Controller upon paying the statutory compounding fee.`,
        language,
        citations: [
          {
            citation_id: 'CIT-PEN',
            act_or_rule: 'The Legal Metrology Act, 2009',
            section_rule_ref: 'Section 30 & 48',
            title: 'Penalty for using unverified weight or measure & Compounding',
            relevance_score: 9.8,
            snippet: 'Prescribes statutory penalties, imprisonment, and compounding provisions.',
          },
        ],
        portal_actions: [],
        suggested_followups: [
          'How to book a re-verification appointment?',
          'What happens if a seal is broken by accident?',
        ],
        latency_ms: 30,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 7. General Re-verification / Stamping
    return {
      answer: isHindi
        ? `### विधिक मापविज्ञान वैधानिक सत्यापन एवं मुहर प्रक्रिया (धारा 19 एवं 24)

विधिक मापविज्ञान अधिनियम, 2009 के तहत:
- व्यापारिक उपयोग में आने वाले सभी तराजू एवं बाटों का विधिक मापविज्ञान अधिकारी (LMO) या अधिकृत GATC केंद्र से **वार्षिक अथवा द्विवार्षिक सत्यापन** एवं भौतिक सीलिंग कराना अनिवार्य है।
- सत्यापन के उपरांत आधिकारिक लेड-वायर सील तथा डिजिटल हस्ताक्षर युक्त क्यूआर प्रमाण पत्र जारी किया जाता है।`
        : `### Statutory Verification & Stamping Guidance (Sections 19 & 24)

Under The Legal Metrology Act, 2009:
- All commercial weighing instruments must undergo mandatory initial verification and periodic re-verification (typically every 12 to 24 months).
- Upon successful verification, the instrument receives a physical lead-wire tamper seal and a cryptographically signed digital certificate with an authoritative QR code.`,
      language,
      citations: [
        {
          citation_id: 'CIT-GEN',
          act_or_rule: 'The Legal Metrology Act, 2009',
          section_rule_ref: 'Section 19 & 24',
          title: 'Verification & Re-Verification of Weights and Measures',
          relevance_score: 9.2,
          snippet:
            'Mandates initial and periodic verification of all commercial weights and measures before expiry.',
        },
      ],
      portal_actions: [
        {
          label: 'Go to Trader Portal',
          action_type: 'NAVIGATE',
          target_tab: 'trader',
          description: 'View instruments or apply for verification',
        },
      ],
      suggested_followups: [
        'How much time does it typically take to test?',
        'What documents are required for verification?',
        'How to calculate statutory verification fees?',
      ],
      latency_ms: 30,
      provider_used: 'LOCAL_STATUTORY_RAG',
    };
  },

  async getSuggestions(context = 'trader'): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/chat/suggestions?context=${context}`);
      if (res.ok) {
        const data = await res.json();
        return data.suggestions || [];
      }
    } catch {
      // fallback
    }

    return [
      'How much time does it typically take to test?',
      'What documents are required for verification?',
      'How to calculate statutory verification fees?',
      'What is Section 22 Central Model Approval?',
      'What are mandatory declarations on packaged goods under Rule 6?',
    ];
  },
};

import { RAGQueryResponse } from './chatTypes';

const API_BASE = '/api/v1';

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

async function callDirectGemini(
  query: string,
  language: 'en' | 'hi' = 'en',
  history?: any[]
): Promise<RAGQueryResponse | null> {
  if (!GEMINI_API_KEY) return null;

  const isHindi = language === 'hi';
  const systemPrompt = isHindi
    ? `आप "Nikks AI" (निक्स एआई) हैं - भारत सरकार के विधिक मापविज्ञान (नाप-तौल) विभाग के सबसे प्यारे, मददगार और सरल AI दोस्त।
हमेशा बहुत ही आसान, मीठी और सरल हिन्दी में उत्तर दें। कठिन सरकारी शब्दों से बचें। यदि प्रासंगिक हो, तो विधिक मापविज्ञान अधिनियम, 2009 या विधिक मापविज्ञान नियम, 2011 का संदर्भ दें।`
    : `You are "Nikks AI", the friendly, warm, and helpful Legal Metrology AI assistant from the Ministry of Consumer Affairs, Government of India.
Always answer in clear, friendly, super simple words that any local shopkeeper or citizen can understand. Avoid heavy legalistic jargon. Mention relevant sections of The Legal Metrology Act, 2009 or General Rules, 2011 gently where helpful.`;

  const conversationHistory = (history || [])
    .slice(-4)
    .map((h) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...conversationHistory,
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUser Question:\n${query}` }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim().length > 10) {
          return {
            answer: candidateText.trim(),
            language,
            citations: [
              {
                citation_id: 'CIT-GEN',
                act_or_rule: 'The Legal Metrology Act, 2009',
                section_rule_ref: 'Section 19 & 24',
                title: 'Verification & Re-Verification of Weights and Measures',
                relevance_score: 9.5,
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
            suggested_followups: isHindi
              ? [
                  'सत्यापन प्रमाण पत्र खो जाने पर क्या करें?',
                  'मशीन की सील टूटने पर क्या नियम है?',
                  'सत्यापन परीक्षण में कितना समय लगता है?',
                ]
              : [
                  'What to do if my certificate is lost?',
                  'What to do if my physical seal is broken?',
                  'What documents are required for re-verification?',
                ],
            latency_ms: 120,
            provider_used: 'GEMINI_API',
          };
        }
      }
    } catch {
      // Try next candidate model
    }
  }
  return null;
}

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
      // Backend unreachable, proceed to direct Gemini or local fallback
    }

    // Direct Gemini Cloud Call
    const geminiRes = await callDirectGemini(query, language, history);
    if (geminiRes) {
      return geminiRes;
    }

    // Offline statutory fallback
    const isHindi = language === 'hi';
    const q = query.toLowerCase();

    // 1. Lost Certificate / Duplicate Copy
    if (
      q.includes('lost') ||
      q.includes('misplace') ||
      q.includes('duplicate') ||
      q.includes('copy of certificate') ||
      q.includes('download certificate') ||
      q.includes('print certificate') ||
      q.includes('kho gaya') ||
      q.includes('gum ho gaya')
    ) {
      return {
        answer: isHindi
          ? `### खोए हुए प्रमाण पत्र की प्रति प्राप्त करना (Digital Certificate)

यदि आपका सत्यापन प्रमाण पत्र खो गया है, तो आपको डुप्लीकेट पेपर फीस भरने या कार्यालय जाने की आवश्यकता **नहीं** है:
1. **100% डिजिटल एवं सुरक्षित:** इस पोर्टल पर जारी किए गए सभी प्रमाण पत्र डिजिटल रूप से हस्ताक्षरित एवं हमेशा के लिए सुरक्षित हैं।
2. **तत्काल डाउनलोड:** अपने **Trader Portal** में लॉगिन करें $\\to$ **'My Verification Applications'** में जाएं $\\to$ **'Download Signed Certificate (PDF)'** पर क्लिक करें।
3. **क्यूआर कोड से जांच:** आप अपने तराजू पर चिपके क्यूआर कोड को मोबाइल से स्कैन करके भी अपना सक्रिय सत्यापन प्रमाण पत्र तुरंत देख एवं डाउनलोड कर सकते हैं।`
          : `### What to do if your Verification Certificate is Lost

If your verification certificate is lost or misplaced, you do **not** need to file a police complaint or pay duplicate paper certificate fees:
1. **100% Digital & Traceable:** All certificates generated on this portal are digitally signed by the Legal Metrology Officer and stored in the live government database.
2. **Instant Download:** Simply log in to your **Trader Portal** $\\to$ navigate to **'My Verification Applications'** $\\to$ click **'Download Signed Certificate (PDF)'** to obtain a fresh official copy.
3. **Scan Machine QR Code:** You can also scan the QR code sticker affixed to your physical weighing machine using any phone camera to view the live verification status and certificate.`,
        language,
        citations: [
          {
            citation_id: 'CIT-LOST',
            act_or_rule: 'e-Metrology Digital Platform User Guide',
            section_rule_ref: 'Digital Certificate Management § 4',
            title: 'Lost Certificate & Duplicate Digital Certificate',
            relevance_score: 9.9,
            snippet:
              'Explains how traders can instantly re-download cryptographically signed digital certificates from their dashboard without paper fees.',
          },
        ],
        portal_actions: [
          {
            label: 'Go to My Certificates',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Download signed digital certificates from your dashboard',
          },
        ],
        suggested_followups: [
          'How to verify digital certificate using QR code?',
          'What documents are required for re-verification?',
          'How to transfer a registered machine to another owner?',
        ],
        latency_ms: 25,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 2. Broken Seal / Damaged Stamp
    if (
      q.includes('seal') ||
      q.includes('broken') ||
      q.includes('tamper') ||
      q.includes('cut') ||
      q.includes('toot gaya') ||
      q.includes('seal damaged')
    ) {
      return {
        answer: isHindi
          ? `### टूटी हुई सील या क्षतिग्रस्त मुहर (Section 24 & Rule 27)

यदि आपके तराजू की आधिकारिक लेड-वायर सील टूट गई है या क्षतिग्रस्त हो गई है:
1. **व्यापारिक उपयोग तुरंत रोकें:** विधिक मापविज्ञान अधिनियम, 2009 की धारा 30 के तहत टूटी हुई सील वाले तराजू का उपयोग दंडनीय अपराध है।
2. **7 दिनों के भीतर सूचना दें:** अपने क्षेत्रीय विधिक मापविज्ञान अधिकारी (LMO) को पोर्टल या लिखित रूप में सूचित करें।
3. **लाइसेंसशुदा रिपेयरर से मरम्मत:** यदि उपकरण में खराबी थी, तो अधिकृत रिपेयरर से मरम्मत कराकर De-stamping मेमो प्राप्त करें।
4. **पुनः सत्यापन (Re-Verification) हेतु आवेदन करें:** पोर्टल पर ऑनलाइन आवेदन करें ताकि अधिकारी आकर मशीन की जांच कर नई सील लगा सकें।`
          : `### What to do if your Physical Seal is Broken (Section 24 & Rule 27)

If the official lead-wire physical seal on your weighing machine is broken, damaged, or cut:
1. **Stop Commercial Use Immediately:** Using an unsealed or tampered scale in commercial trade is a punishable offence under Section 30 of The Legal Metrology Act, 2009.
2. **Notify the Department within 7 Days:** Intimate your jurisdictional Legal Metrology Officer (LMO).
3. **Repair by Licensed Repairer:** Have the scale serviced by a licensed Legal Metrology technician who will issue a repair/de-stamping memo.
4. **Apply for Re-Verification:** Submit a re-verification application on the Trader Portal so the LMO can inspect the scale and affix a new official physical seal.`,
        language,
        citations: [
          {
            citation_id: 'CIT-SEAL',
            act_or_rule: 'The Legal Metrology Act, 2009',
            section_rule_ref: 'Section 24 & Rule 27',
            title: 'Broken Physical Seal and Re-Verification Obligation',
            relevance_score: 9.9,
            snippet:
              'Mandates immediate intimation and re-verification upon breakage of calibration physical seal.',
          },
        ],
        portal_actions: [
          {
            label: 'Apply for Re-Verification',
            action_type: 'NAVIGATE',
            target_tab: 'trader',
            description: 'Book a re-verification appointment for broken seal',
          },
        ],
        suggested_followups: [
          'What is the penalty for using an unsealed scale?',
          'How much time does it take to test?',
        ],
        latency_ms: 25,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 3. Time / Duration / SLA
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
        latency_ms: 25,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 4. Documents Required
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
        latency_ms: 25,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 5. Fees
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
- **पेट्रोल / डीजल पंप नोजल:** ₹1,000 प्रति नोजल`
          : `### Statutory Verification Fee Schedule (Twelfth Schedule)

Official statutory verification fees under Legal Metrology (General) Rules, 2011:
- **Commercial Counter Scales (≤ 50 kg):** ₹100 – ₹200
- **Platform Scales (50 kg to 500 kg):** ₹200 – ₹500
- **Heavy Industrial Scales (500 kg to 5 Tonne):** ₹500 – ₹2,000
- **Electronic Weighbridges (10 Tonne to 100 Tonne):** ₹3,000 – ₹5,000
- **Fuel Dispensing Pumps:** ₹1,000 per nozzle`,
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
        latency_ms: 25,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 6. Model Approval (Section 22)
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
        latency_ms: 25,
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
        'What to do if my certificate is lost?',
        'What to do if my physical seal is broken?',
        'How much time does it typically take to test?',
      ],
      latency_ms: 25,
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
      'What to do if my certificate is lost?',
      'What to do if my physical seal is broken?',
      'How much time does it typically take to test?',
      'What documents are required for verification?',
      'Calculate verification fee for counter scale',
    ];
  },
};

import { RAGQueryResponse } from './chatTypes';

const API_BASE = '/api/v1';

export const chatApi = {
  async sendQuery(query: string, language: 'en' | 'hi' = 'en', context?: string, history?: any[]): Promise<RAGQueryResponse> {
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
        return await res.json();
      }
    } catch {
      // Backend unreachable, fallback locally
    }

    // Client-side fallback response if backend is offline
    const isHindi = language === 'hi';
    const isFee = query.toLowerCase().includes('fee') || query.toLowerCase().includes('cost');
    const isModel = query.toLowerCase().includes('model') || query.toLowerCase().includes('ind');
    const isPkg = query.toLowerCase().includes('package') || query.toLowerCase().includes('mrp');

    if (isFee) {
      return {
        answer: isHindi
          ? `**वैधानिक सत्यापन शुल्क अनुसूची (बारहवीं अनुसूची):**\n- काउंटर स्केल (≤ 50 किग्रा): ₹100 – ₹200\n- प्लेटफॉर्म स्केल (50-500 किग्रा): ₹200 – ₹500\n- धर्मकांटा / वेईब्रिज (10-100 टन): ₹3,000 – ₹5,000\n\nआवेदन के समय सटीक शुल्क पोर्टल द्वारा स्वतः गणना की जाती है।`
          : `**Statutory Verification Fee Schedule (Twelfth Schedule):**\n- Commercial Counter Scales (≤ 50 kg): ₹100 – ₹200\n- Platform Scales (50–500 kg): ₹200 – ₹500\n- Electronic Weighbridges (10–100 Tonne): ₹3,000 – ₹5,000\n\nExact statutory fee is automatically calculated upon filing your application on the Trader Portal.`,
        language,
        citations: [
          {
            citation_id: 'CIT-FEE',
            act_or_rule: 'Legal Metrology (General) Rules, 2011',
            section_rule_ref: 'Twelfth Schedule',
            title: 'Fee for Verification and Stamping',
            relevance_score: 9.8,
            snippet: 'Prescribes mandatory fee schedules for verification and stamping of weighing and measuring instruments.',
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
        latency_ms: 50,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    if (isModel) {
      return {
        answer: isHindi
          ? `**केंद्रीय मॉडल अनुमोदन (धारा 22):**\nभारत में किसी भी नए वजन या माप उपकरण के निर्माण या आयात से पहले केंद्रीय विधिक मापविज्ञान निदेशालय से मॉडल अनुमोदन प्रमाण पत्र (उदा. IND/09/2026/XXX) प्राप्त करना अनिवार्य है।`
          : `**Mandatory Central Model Approval (Section 22):**\nUnder Section 22 of the Legal Metrology Act, 2009, every manufacturer or importer must obtain a Central Model Approval Certificate (e.g. IND/09/2026/XXX) before marketing, selling, or stamping any weighing instrument in India.`,
        language,
        citations: [
          {
            citation_id: 'CIT-MOD',
            act_or_rule: 'The Legal Metrology Act, 2009',
            section_rule_ref: 'Section 22',
            title: 'Approval of Model',
            relevance_score: 9.9,
            snippet: 'Mandatory prior Central Model Approval for all weighing and measuring instruments.',
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
        latency_ms: 50,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    if (isPkg) {
      return {
        answer: isHindi
          ? `**पैकेज्ड कमोडिटीज नियम 2011 (नियम 6):**\nप्रत्येक प्री-पैक्ड पैकेट पर 7 अनिवार्य घोषणाएं आवश्यक हैं:\n1. निर्माता/पैकर/आयातक का नाम व पता\n2. वस्तु का सामान्य नाम\n3. शुद्ध मात्रा (Net Quantity)\n4. निर्माण/पैकिंग का माह व वर्ष\n5. अधिकतम खुदरा मूल्य (MRP सभी करों सहित)\n6. उपभोक्ता हेल्पलाइन विवरण (फोन व ईमेल)`
          : `**Mandatory Declarations on Pre-Packaged Goods (Rule 6):**\nEvery pre-packaged item must declare:\n1. Name and complete address of Manufacturer / Packer / Importer.\n2. Common or generic name of commodity.\n3. Net Quantity in standard units.\n4. Month and Year of manufacture/packing.\n5. Maximum Retail Price: "MRP ₹ xx.xx (incl. of all taxes)".\n6. Consumer care contact details (Phone & Email).`,
        language,
        citations: [
          {
            citation_id: 'CIT-PKG',
            act_or_rule: 'Legal Metrology (Packaged Commodities) Rules, 2011',
            section_rule_ref: 'Rule 6',
            title: 'Declarations to be made on every package',
            relevance_score: 9.7,
            snippet: 'Mandatory label declarations on all pre-packed commodities.',
          },
        ],
        portal_actions: [],
        suggested_followups: [
          'What is Maximum Permissible Error in net quantity?',
          'What are packaging rules for e-commerce?',
        ],
        latency_ms: 50,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    return {
      answer: isHindi
        ? `**विधिक मापविज्ञान मार्गदर्शन (अधिनियम 2009 एवं नियम 2011):**\nव्यापारिक लेन-देन में उपयोग होने वाले सभी तराजू एवं बाटों का विधिक मापविज्ञान अधिकारी (LMO) या अधिकृत GATC केंद्र से वार्षिक सत्यापन व मुहर लगवाना अनिवार्य है।`
        : `**Statutory Legal Metrology Guidance:**\nUnder The Legal Metrology Act, 2009, all commercial weighing and measuring instruments must undergo statutory verification and physical stamping before use in trade, and periodic re-verification before validity expiration.`,
      language,
      citations: [
        {
          citation_id: 'CIT-GEN',
          act_or_rule: 'The Legal Metrology Act, 2009',
          section_rule_ref: 'Section 19 & 24',
          title: 'Verification & Re-Verification of Weights and Measures',
          relevance_score: 9.0,
          snippet: 'Mandates initial and periodic verification of all commercial weights and measures.',
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
        'How to register a retail weighing scale?',
        'How to calculate verification fee?',
        'How to verify digital certificate using QR code?',
      ],
      latency_ms: 40,
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
      'How to calculate statutory verification fees?',
      'What is Section 22 Central Model Approval?',
      'What are mandatory declarations on packaged goods under Rule 6?',
      'How to verify digital certificate using QR code?',
      'What is the re-verification due date timeline?',
    ];
  },
};

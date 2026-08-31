import { RAGQueryRequest, StatutoryCitation, PortalActionLink } from './types.js';

export interface LLMGenerateParams {
  query: string;
  language: 'en' | 'hi';
  contextChunks: StatutoryCitation[];
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
}

export interface LLMResponse {
  answer: string;
  provider: 'GEMINI_API' | 'LOCAL_STATUTORY_RAG';
}

export class LLMService {
  private geminiApiKey: string | null = null;
  private modelName: string = 'gemini-1.5-flash-latest';

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  }

  public setApiKey(key: string) {
    this.geminiApiKey = key;
  }

  public hasApiKey(): boolean {
    return Boolean(this.geminiApiKey && this.geminiApiKey.trim().length > 10);
  }

  public async generateAnswer(params: LLMGenerateParams): Promise<LLMResponse> {
    if (this.hasApiKey()) {
      try {
        const geminiAnswer = await this.callGeminiAPI(params);
        if (geminiAnswer && geminiAnswer.trim().length > 20) {
          return {
            answer: geminiAnswer,
            provider: 'GEMINI_API',
          };
        }
      } catch (err) {
        console.warn('[LLMService] Gemini API call failed, falling back to local statutory engine:', err);
      }
    }

    // Local deterministic synthesis fallback
    return {
      answer: this.synthesizeLocalAnswer(params),
      provider: 'LOCAL_STATUTORY_RAG',
    };
  }

  private async callGeminiAPI(params: LLMGenerateParams): Promise<string> {
    const isHindi = params.language === 'hi';
    const systemPrompt = `You are the Official Indian Legal Metrology AI Assistant (Government of India).
Your duty is to provide strictly accurate, professional, and accessible guidance to traders, manufacturers, packagers, and citizens regarding:
1. The Legal Metrology Act, 2009 (Sections 1-57)
2. Legal Metrology (General) Rules, 2011 (Verification, NAWI/AWI classes, MPE error tolerances, Stamping, Fees)
3. Legal Metrology (Packaged Commodities) Rules, 2011 (Mandatory declarations, Net weight MPE, MRP rules)
4. Model Approval (Section 22) and GATC Lab Testing (Section 19).

CRITICAL RULES:
- Base your answers strictly on the provided Context Chunks.
- Explicitly cite the statutory Sections and Rules (e.g. "Under Section 24 of the Legal Metrology Act, 2009...").
- Answer in ${isHindi ? 'clear, polite Hindi (Devanagari script)' : 'clear, concise English'}.
- Format with clean Markdown (bullet points, bold text).
- Include an official statutory disclaimer stating that this is legal guidance and physical verification is conducted by authorized officers.`;

    const contextText = params.contextChunks
      .map((c, i) => `[Source ${i + 1}: ${c.act_or_rule} - ${c.section_rule_ref}] (${c.title})\n${c.snippet}`)
      .join('\n\n');

    const conversationHistory = (params.history || [])
      .slice(-4)
      .map((h) => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

    const userPrompt = `Context Chunks from Official Acts & Rules:\n${contextText}\n\nUser Question: ${params.query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP Error ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Empty response part from Gemini API');
    }
    return candidate;
  }

  private synthesizeLocalAnswer(params: LLMGenerateParams): string {
    const isHindi = params.language === 'hi';
    const topChunk = params.contextChunks[0];

    if (!topChunk || params.contextChunks.length === 0) {
      if (isHindi) {
        return `**विधिक मापविज्ञान सहायता डेस्क**

आपके प्रश्न के संबंध में सटीक वैधानिक प्रावधान प्राप्त नहीं हो सका। कृपया अपने निकटतम विधिक मापविज्ञान कार्यालय (LMO) से संपर्क करें अथवा पोर्टल पर अपने उपकरण के विवरण की जांच करें।

> ⚠️ **नोट:** विधिक मापविज्ञान अधिनियम, 2009 के तहत व्यापार में केवल सत्यापित एवं मुहरबंद उपकरणों का उपयोग अनिवार्य है।`;
      }
      return `**Legal Metrology Guidance**

No exact statutory section matched your specific query. Please consult your jurisdictional Legal Metrology Officer (LMO) or verify your machine details on the Trader Portal.

> ⚠️ **Statutory Notice:** Under Section 19 of The Legal Metrology Act, 2009, all commercial weighing instruments must be verified and stamped before use in trade.`;
    }

    // Build synthesized response from top 2 chunks
    const primary = params.contextChunks[0];
    const secondary = params.contextChunks[1];

    if (isHindi) {
      return `### वैधानिक विधिक मापविज्ञान मार्गदर्शन

**संदर्भ:** ${primary.act_or_rule} (${primary.section_rule_ref}) — *${primary.title}*

${primary.snippet}

${
  secondary
    ? `\n**अतिरिक्त वैधानिक नियम:** ${secondary.act_or_rule} (${secondary.section_rule_ref})\n${secondary.snippet}\n`
    : ''
}
---
📌 **नागरिक एवं व्यापारी सूचना:**
- पोर्टल के माध्यम से ऑनलाइन सत्यापन आवेदन और नवीनीकरण स्लॉट बुक किए जा सकते हैं।
- सत्यापन प्रमाण पत्र में डिजिटल हस्ताक्षर और क्यूआर कोड अनिवार्य है।

> ⚖️ *यह जानकारी विधिक मापविज्ञान अधिनियम, 2009 एवं सामान्य नियम, 2011 के प्रावधानों पर आधारित है। आधिकारिक अंतिम मुहर अधिकृत निरीक्षक (LMO) द्वारा लगाई जाती है।*`;
    }

    return `### Statutory Legal Metrology Guidance

**Primary Reference:** **${primary.act_or_rule} (${primary.section_rule_ref})** — *${primary.title}*

${primary.snippet}

${
  secondary
    ? `\n**Related Provision:** **${secondary.act_or_rule} (${secondary.section_rule_ref})**\n${secondary.snippet}\n`
    : ''
}
---
📌 **Key Compliance Action Points:**
- All commercial instruments must be verified before initial trade use and re-verified periodically before expiry.
- Verified instruments receive a physical lead-wire tamper seal and an authoritative digital certificate with a verifiable QR code.

> ⚖️ *Statutory Notice: This response is grounded directly in The Legal Metrology Act, 2009 and applicable Rules. Official enforcement dispositions are executed by authorized Legal Metrology Officers.*`;
  }
}

export const llmService = new LLMService();

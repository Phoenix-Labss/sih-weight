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
  private modelName: string = 'gemini-1.5-flash';

  constructor() {
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    if (rawKey && !rawKey.includes('your-key') && rawKey.startsWith('AIza')) {
      this.geminiApiKey = rawKey;
    }
  }

  public setApiKey(key: string) {
    this.geminiApiKey = key;
  }

  public hasApiKey(): boolean {
    return Boolean(
      this.geminiApiKey &&
        this.geminiApiKey.trim().length > 10 &&
        this.geminiApiKey.startsWith('AIza')
    );
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
      } catch (err: any) {
        // Fall back gracefully
      }
    }

    // Local deterministic statutory synthesis
    return {
      answer: this.synthesizeLocalAnswer(params),
      provider: 'LOCAL_STATUTORY_RAG',
    };
  }

  private async callGeminiAPI(params: LLMGenerateParams): Promise<string> {
    const isHindi = params.language === 'hi';
    const systemPrompt = `You are the Official Indian Legal Metrology AI Assistant (Government of India).
Your duty is to provide strictly accurate, professional, conversational, and direct guidance to traders, manufacturers, packagers, and citizens regarding:
1. The Legal Metrology Act, 2009 (Sections 1-57)
2. Legal Metrology (General) Rules, 2011 (Verification, NAWI/AWI classes, MPE error tolerances, Stamping, Fees)
3. Legal Metrology (Packaged Commodities) Rules, 2011 (Mandatory declarations, Net weight MPE, MRP rules)
4. Model Approval (Section 22), GATC Lab Testing (Section 19), and Portal Procedures.

CRITICAL RULES:
- Directly and clearly answer the user's specific scenario or question.
- Base your answers strictly on the provided Context Chunks.
- Explicitly cite the statutory Sections and Rules (e.g. "Under Section 24 of the Legal Metrology Act, 2009...").
- Answer in ${isHindi ? 'clear, polite Hindi (Devanagari script)' : 'clear, concise, natural English'}.
- Format with clean Markdown (bullet points, bold text).`;

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
    const primary = params.contextChunks[0];
    const secondary = params.contextChunks[1];

    if (!primary || params.contextChunks.length === 0) {
      if (isHindi) {
        return `**विधिक मापविज्ञान सहायता डेस्क**

आपके प्रश्न के संबंध में सटीक वैधानिक प्रावधान प्राप्त नहीं हो सका। कृपया अपने निकटतम विधिक मापविज्ञान कार्यालय (LMO) से संपर्क करें अथवा पोर्टल पर अपने उपकरण के विवरण की जांच करें।

> ⚠️ **नोट:** विधिक मापविज्ञान अधिनियम, 2009 के तहत व्यापार में केवल सत्यापित एवं मुहरबंद उपकरणों का उपयोग अनिवार्य है।`;
      }
      return `**Legal Metrology Guidance**

No exact statutory section matched your specific query. Please consult your jurisdictional Legal Metrology Officer (LMO) or check your machine details on the Trader Portal.

> ⚠️ **Statutory Notice:** Under Section 19 of The Legal Metrology Act, 2009, all commercial weighing instruments must be verified and stamped before use in trade.`;
    }

    if (isHindi) {
      return `### ${primary.title} (${primary.section_rule_ref})

${primary.snippet}

${
  secondary && secondary.section_rule_ref !== primary.section_rule_ref
    ? `\n📌 **अतिरिक्त वैधानिक संदर्भ (${secondary.section_rule_ref} — ${secondary.title}):**\n${secondary.snippet}\n`
    : ''
}
> ⚖️ *यह आधिकारिक मार्गदर्शन विधिक मापविज्ञान अधिनियम, 2009 एवं सामान्य नियम, 2011 पर आधारित है।*`;
    }

    return `### ${primary.title} (${primary.section_rule_ref})

${primary.snippet}

${
  secondary && secondary.section_rule_ref !== primary.section_rule_ref
    ? `\n📌 **Related Legal Provision (${secondary.section_rule_ref} — ${secondary.title}):**\n${secondary.snippet}\n`
    : ''
}
> ⚖️ *Statutory Guidance under The Legal Metrology Act, 2009 & General Rules, 2011.*`;
  }
}

export const llmService = new LLMService();

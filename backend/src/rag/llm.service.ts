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
  private candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

  constructor() {
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    if (rawKey && rawKey.trim().length > 10 && !rawKey.includes('your-key-here')) {
      this.geminiApiKey = rawKey.trim();
    }
  }

  public setApiKey(key: string) {
    this.geminiApiKey = key.trim();
  }

  public hasApiKey(): boolean {
    return Boolean(
      this.geminiApiKey &&
        this.geminiApiKey.length > 10 &&
        !this.geminiApiKey.includes('your-key-here')
    );
  }

  public async generateAnswer(params: LLMGenerateParams): Promise<LLMResponse> {
    if (this.hasApiKey()) {
      for (const model of this.candidateModels) {
        try {
          const geminiAnswer = await this.callGeminiAPI(params, model);
          if (geminiAnswer && geminiAnswer.trim().length > 15) {
            return {
              answer: geminiAnswer.trim(),
              provider: 'GEMINI_API',
            };
          }
        } catch (err: any) {
          console.warn(`[LLMService] Attempt with model ${model} failed:`, err?.message || err);
        }
      }
    }

    // Local deterministic statutory fallback if all cloud models are unavailable
    return {
      answer: this.synthesizeLocalAnswer(params),
      provider: 'LOCAL_STATUTORY_RAG',
    };
  }

  private async callGeminiAPI(params: LLMGenerateParams, model: string): Promise<string> {
    const isHindi = params.language === 'hi';
    const systemPrompt = `You are the Official Indian Legal Metrology AI Assistant (Ministry of Consumer Affairs, Food and Public Distribution, Government of India).
Your duty is to provide strictly accurate, conversational, friendly, and practical guidance to traders, shopkeepers, manufacturers, packagers, and citizens.

Core Knowledge Foundation:
1. The Legal Metrology Act, 2009 (Sections 1-57)
2. Legal Metrology (General) Rules, 2011 (Verification, NAWI/AWI classes, MPE error tolerances, Stamping, Fees)
3. Legal Metrology (Packaged Commodities) Rules, 2011 (Mandatory declarations, Net weight MPE, MRP rules)
4. Model Approval (Section 22), GATC Lab Testing (Section 19), and Portal Procedures.

CRITICAL INSTRUCTIONS:
- Directly and clearly answer the user's specific question or scenario (e.g. lost certificate, broken seal, verification fees, renewal deadlines, scale accuracy, inspection rules).
- Speak naturally and conversationally in Markdown with clean formatting (bullet points, bold text).
- If the question relates to a statutory rule, cite the relevant Section/Rule.
- Answer in ${isHindi ? 'clear, polite Hindi (Devanagari script)' : 'clear, professional, natural English'}.
- Mention that this portal allows online application filing, tracking, and instant digital certificate downloads with QR code verification.`;

    const contextText = params.contextChunks
      .map((c, i) => `[Statutory Reference ${i + 1}: ${c.act_or_rule} - ${c.section_rule_ref}] (${c.title})\n${c.snippet}`)
      .join('\n\n');

    const conversationHistory = (params.history || [])
      .slice(-4)
      .map((h) => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

    const userPrompt = `Retrieved Official Legal Context:\n${contextText}\n\nUser Question:\n${params.query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status} from ${model}: ${errText}`);
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('No candidate text received from Gemini');
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

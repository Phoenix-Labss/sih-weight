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
  private candidateModels = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'];

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
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_GEMINI_IN_TEST) {
      return false;
    }
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
          // Fall back gracefully
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
    const systemPrompt = isHindi
      ? `आप "Nikks AI" (निक्स एआई) हैं - भारत सरकार के विधिक मापविज्ञान (नाप-तौल) विभाग के सबसे प्यारे, मददगार और सरल AI दोस्त।

🌟 सबसे महत्वपूर्ण निर्देश (टोन एवं भाषा):
1. **भाषा को बहुत ही सरल, आसान और मीठी हिन्दी में रखें:** ऐसी भाषा जिसे 10 साल का बच्चा या कोई भी आम दुकानदार बिना किसी परेशानी के एकदम आसानी से समझ जाए!
2. **भारी-भरकम सरकारी/संस्कृत शब्दों से बचें:** कठिन शब्दों (जैसे 'अधिदेश', 'अध्यारोपित', 'दंडात्मक प्रावधान', 'प्रत्यभिज्ञान') की जगह आसान शब्द (जैसे 'जरूरी नियम', 'चिंता मत कीजिए', 'आसान तरीका', 'मुफ़्त में डाउनलोड') का उपयोग करें।
3. **दोस्ताना और मददगार अंदाज़:** शुरुआत प्यार से करें (जैसे: "अरे, बिल्कुल चिंता मत कीजिए!...", "नमस्ते दोस्त!...")।
4. **आसान उदाहरण/एनालॉजी दें:** जैसे कि "सत्यापन प्रमाण पत्र आपके तराजू का रिपोर्ट कार्ड है", "सील आपके तराजू का सुरक्षा धागा है"।
5. **स्टेप-बाय-स्टेप बुलेट पॉइंट्स:** 1, 2, 3 करके साफ-साफ समझाएं।
6. **नियमों का आसान संदर्भ:** अंत में ब्रैकेट में छोटा सा नोट लिख दें (जैसे: *(विधिक मापविज्ञान नियम 2011 के अनुसार)*)।
7. **पोर्टल की सुविधा बताएं:** बताएं कि इस पोर्टल पर लॉगिन करके सब कुछ 1 मिनट में ऑनलाइन और मुफ़्त में हो जाता है!`
      : `You are "Nikks AI", the friendly, warm, and helpful Legal Metrology AI assistant from the Ministry of Consumer Affairs, Government of India.

🌟 CRITICAL TONE & LANGUAGE INSTRUCTIONS:
1. **Explain Like I'm 5 (Super Simple & Friendly):** Explain things so simply and clearly that even a 10-year-old child or a friendly local shopkeeper can understand instantly!
2. **Avoid Heavy Legal Jargon:** Do NOT use complex bureaucratic legalese like "statutory mandate", "imposition of liability", "indemnification", or "procedural scrutiny". Instead use everyday words like "rules", "report card", "easy steps", "free download", "no worries!".
3. **Warm & Conversational Tone:** Start cheerfully (e.g. "Don't worry at all! Here is the easy way to fix this...", "Hi friend! Great question...").
4. **Use Simple Analogies:** e.g. "Think of a verification certificate like an official digital report card showing your scale is 100% honest and accurate!"
5. **Clear Step-by-Step Bullet Points:** Use numbered lists with friendly emojis (1️⃣, 2️⃣, 3️⃣).
6. **Mention Rules Gently:** Mention statutory sections gently in a short friendly footer note (e.g. *(Under Section 24 of the Legal Metrology Act, 2009)*).
7. **Highlight Online Ease:** Remind the user that they can do everything easily online from their dashboard without paperwork!`;

    const contextText = params.contextChunks
      .map((c, i) => `[Reference ${i + 1}: ${c.act_or_rule} - ${c.section_rule_ref}] (${c.title})\n${c.snippet}`)
      .join('\n\n');

    const conversationHistory = (params.history || [])
      .slice(-4)
      .map((h) => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

    const userPrompt = isHindi
      ? `सरकारी नियम संदर्भ (Context):\n${contextText}\n\nउपयोगकर्ता का सवाल (कृपया बहुत ही आसान, मीठी और सरल हिन्दी में उत्तर दें):\n${params.query}`
      : `Official Legal Context:\n${contextText}\n\nUser Question (Please answer in super simple, friendly, child-like easy words):\n${params.query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3500),
      body: JSON.stringify({
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.4,
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
        return `### नमस्ते दोस्त! 👋

मुझे आपके इस सवाल की पूरी जानकारी नहीं मिल पाई। पर चिंता मत कीजिए! आप अपने नज़दीकी नाप-तौल अधिकारी (LMO) से पूछ सकते हैं या अपने पोर्टल पर मशीन की जानकारी देख सकते हैं।

> 💡 **याद रखें:** दुकान में हमेशा सरकार द्वारा जांचा और मुहर लगा तराजू ही इस्तेमाल करना चाहिए।`;
      }
      return `### Hi friend! 👋

I couldn't find the exact details for this specific question. But don't worry! You can check your machine details on your dashboard or ask your local weights & measures inspector.

> 💡 **Quick Tip:** Always use an approved and checked scale in your shop to keep your customers happy!`;
    }

    if (isHindi) {
      return `### विधिक मापविज्ञान: ${primary.title}

${primary.snippet}

${
  secondary && secondary.section_rule_ref !== primary.section_rule_ref
    ? `\n📌 **एक और काम की बात (${secondary.title}):**\n${secondary.snippet}\n`
    : ''
}
> ⚖️ *विधिक मापविज्ञान नियम संदर्भ: ${primary.act_or_rule} (${primary.section_rule_ref})*`;
    }

    return `### ${primary.title}

${primary.snippet}

${
  secondary && secondary.section_rule_ref !== primary.section_rule_ref
    ? `\n📌 **Helpful Related Info (${secondary.title}):**\n${secondary.snippet}\n`
    : ''
}
> ⚖️ *Official Rule Reference: ${primary.act_or_rule} (${primary.section_rule_ref})*`;
  }
}

export const llmService = new LLMService();

import { prisma } from '../db/prisma.js';
import { STATUTORY_CORPUS } from './statutoryCorpus.js';
import {
  RAGQueryRequest,
  RAGQueryResponse,
  StatutoryCitation,
  PortalActionLink,
  StatutoryKnowledgeItem,
} from './types.js';
import { llmService } from './llm.service.js';

export class RAGService {
  private seeded = false;

  public async seedKnowledgeBase(): Promise<number> {
    try {
      const count = await prisma.knowledgeChunk.count();
      if (count > 0) {
        this.seeded = true;
        return count;
      }

      for (const item of STATUTORY_CORPUS) {
        await prisma.knowledgeChunk.create({
          data: {
            category: item.category,
            act_name: item.act_name,
            section_rule_ref: item.section_rule_ref,
            title: item.title,
            content: item.content,
            keywords: item.keywords.join(','),
            citation_label: item.citation_label,
            is_active: true,
          },
        });
      }
      this.seeded = true;
      return STATUTORY_CORPUS.length;
    } catch (err) {
      console.warn('[RAGService] Note: PostgreSQL knowledge seeding fallback to in-memory corpus:', err);
      return STATUTORY_CORPUS.length;
    }
  }

  public async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    const queryStr = (request.query || '').trim().toLowerCase();
    const lang = request.language || 'en';

    if (!queryStr) {
      return {
        answer: 'Please enter a legal metrology question regarding instrument verification, fee schedules, model approvals, or packaged commodity rules.',
        language: lang,
        citations: [],
        portal_actions: [],
        suggested_followups: this.getSuggestions(request.portal_context),
        latency_ms: 0,
        provider_used: 'LOCAL_STATUTORY_RAG',
      };
    }

    // 1. Retrieve top matching chunks via Hybrid Search
    const citations = await this.retrieveRelevantChunks(queryStr, 3);

    // 2. Extract associated portal actions
    const portalActions: PortalActionLink[] = [];
    for (const item of STATUTORY_CORPUS) {
      if (item.portal_action && citations.some((c) => c.section_rule_ref === item.section_rule_ref)) {
        if (!portalActions.some((p) => p.label === item.portal_action?.label)) {
          portalActions.push(item.portal_action);
        }
      }
    }

    // 3. Generate structured response via LLM service
    const llmResult = await llmService.generateAnswer({
      query: request.query,
      language: lang,
      contextChunks: citations,
      history: request.history,
    });

    // 4. Derive dynamic follow-up suggestions
    const followups = this.deriveFollowups(queryStr, citations);

    const latency = Date.now() - startTime;

    return {
      answer: llmResult.answer,
      language: lang,
      citations,
      portal_actions: portalActions,
      suggested_followups: followups,
      latency_ms: latency,
      provider_used: llmResult.provider,
    };
  }

  private async retrieveRelevantChunks(query: string, topK = 3): Promise<StatutoryCitation[]> {
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored: Array<{ item: StatutoryKnowledgeItem; score: number }> = [];

    for (const item of STATUTORY_CORPUS) {
      let score = 0;
      const contentLower = item.content.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const refLower = item.section_rule_ref.toLowerCase();
      const actLower = item.act_name.toLowerCase();

      for (const token of tokens) {
        // Keyword exact match
        if (item.keywords.some((kw) => kw.toLowerCase().includes(token))) {
          score += 3.0;
        }
        // Section/Rule direct mention (e.g. "section 22", "rule 6")
        if (refLower.includes(token)) {
          score += 4.0;
        }
        // Title match
        if (titleLower.includes(token)) {
          score += 2.5;
        }
        // Content match
        if (contentLower.includes(token)) {
          score += 1.0;
        }
        if (actLower.includes(token)) {
          score += 0.5;
        }
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // If no score, return top 2 general provisions
    const selected = scored.length > 0
      ? scored.slice(0, topK)
      : STATUTORY_CORPUS.slice(0, 2).map((item) => ({ item, score: 0.5 }));

    return selected.map(({ item, score }, index) => ({
      citation_id: `CIT-${index + 1}`,
      act_or_rule: item.act_name,
      section_rule_ref: item.section_rule_ref,
      title: item.title,
      relevance_score: Math.min(Math.round(score * 10) / 10, 10.0),
      snippet: item.content,
    }));
  }

  public getSuggestions(portalContext?: string): string[] {
    if (portalContext === 'trader') {
      return [
        'How to register a retail weighing scale?',
        'Calculate verification fee for 30kg counter scale',
        'What is the re-verification validity period?',
        'How to schedule on-site weighbridge verification?',
      ];
    }

    if (portalContext === 'public') {
      return [
        'How to verify digital certificate using QR code?',
        'What are mandatory declarations on packaged goods?',
        'What is the penalty for using an unverified scale?',
        'What is Section 22 Central Model Approval?',
      ];
    }

    return [
      'What are mandatory packaging declarations under Rule 6?',
      'How to calculate statutory verification fees?',
      'What are Maximum Permissible Errors (MPE) for Class III scales?',
      'How does Section 22 Model Approval work?',
      'What is the re-verification due date timeline?',
    ];
  }

  private deriveFollowups(query: string, citations: StatutoryCitation[]): string[] {
    const q = query.toLowerCase();
    if (q.includes('fee') || q.includes('cost') || q.includes('charge')) {
      return [
        'What are the fees for weighbridge verification?',
        'How to make payment for verification application?',
        'Are there extra conveyance charges for on-site inspection?',
      ];
    }

    if (q.includes('package') || q.includes('mrp') || q.includes('label')) {
      return [
        'What is Maximum Permissible Error in net quantity?',
        'Are declarations mandatory on e-commerce websites?',
        'What is the penalty for missing MRP or net weight?',
      ];
    }

    if (q.includes('model') || q.includes('ind/')) {
      return [
        'Who issues the Certificate of Model Approval?',
        'Can I verify a machine without Model Approval?',
        'How to check approved model numbers on this portal?',
      ];
    }

    return [
      'How to book a periodic re-verification slot?',
      'What happens if an inspector finds broken physical seal?',
      'How to verify certificate authenticity via QR code?',
    ];
  }
}

export const ragService = new RAGService();

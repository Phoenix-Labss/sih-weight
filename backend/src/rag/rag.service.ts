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
      // Clear out older seed chunks and refresh with latest full corpus
      await prisma.knowledgeChunk.deleteMany({});
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

    // 1. Retrieve top matching chunks via Hybrid Search with phrase boosting
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
    const queryLower = query.toLowerCase();
    const tokens = queryLower
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

      // High-priority phrase matching
      if (item.keywords.some((kw) => queryLower.includes(kw.toLowerCase()))) {
        score += 8.0;
      }
      if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
        score += 6.0;
      }

      // Token level matching
      for (const token of tokens) {
        if (item.keywords.some((kw) => kw.toLowerCase().includes(token))) {
          score += 3.0;
        }
        if (refLower.includes(token)) {
          score += 4.0;
        }
        if (titleLower.includes(token)) {
          score += 2.5;
        }
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
        'What to do if my certificate is lost?',
        'What to do if my physical seal is broken?',
        'How much time does it typically take to test?',
        'What documents are required for verification?',
        'Calculate verification fee for counter scale',
      ];
    }

    return [
      'What to do if my certificate is lost?',
      'What to do if my physical seal is broken?',
      'How to verify digital certificate using QR code?',
      'What are mandatory packaging declarations under Rule 6?',
      'What is Section 22 Central Model Approval?',
    ];
  }

  private deriveFollowups(query: string, citations: StatutoryCitation[]): string[] {
    const q = query.toLowerCase();

    if (q.includes('lost') || q.includes('duplicate')) {
      return [
        'How to verify digital certificate using QR code?',
        'What documents are required for re-verification?',
        'How to transfer a registered machine to another owner?',
      ];
    }

    if (q.includes('seal') || q.includes('broken')) {
      return [
        'What is the penalty for using an unsealed scale?',
        'How to book a re-verification appointment?',
        'Who is authorized to break or repair an official seal?',
      ];
    }

    if (q.includes('time') || q.includes('duration')) {
      return [
        'What documents are required for verification?',
        'How to calculate statutory verification fees?',
        'What is the re-verification validity period?',
      ];
    }

    if (q.includes('fee') || q.includes('cost') || q.includes('charge')) {
      return [
        'What are the fees for weighbridge verification?',
        'How to make payment for verification application?',
        'Are there extra conveyance charges for on-site inspection?',
      ];
    }

    return [
      'What to do if my certificate is lost?',
      'What to do if my physical seal is broken?',
      'How to verify certificate authenticity via QR code?',
    ];
  }
}

export const ragService = new RAGService();

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { ragService } from '../src/rag/rag.service.js';
import { STATUTORY_CORPUS } from '../src/rag/statutoryCorpus.js';

describe('Legal Metrology RAG & Chatbot Engine Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await ragService.seedKnowledgeBase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Statutory Corpus Integrity', () => {
    it('has indexed all core statutory categories', () => {
      expect(STATUTORY_CORPUS.length).toBeGreaterThanOrEqual(10);
      const categories = STATUTORY_CORPUS.map((c) => c.category);
      expect(categories).toContain('ACT');
      expect(categories).toContain('GENERAL_RULES');
      expect(categories).toContain('PACKAGED_COMMODITIES');
      expect(categories).toContain('FEE_SCHEDULE');
    });
  });

  describe('RAG Hybrid Retrieval & Grounding', () => {
    it('retrieves Section 22 for Model Approval queries', async () => {
      const result = await ragService.query({
        query: 'What is mandatory Central Model Approval for weighing scale?',
        language: 'en',
      });

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations.some((c) => c.section_rule_ref.includes('Section 22'))).toBe(true);
      expect(result.answer).toContain('Model Approval');
    });

    it('retrieves Rule 6 for Packaged Commodity label declaration queries', async () => {
      const result = await ragService.query({
        query: 'What are mandatory declarations on pre-packaged goods and MRP?',
        language: 'en',
      });

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations.some((c) => c.section_rule_ref.includes('Rule 6'))).toBe(true);
      expect(result.answer).toContain('MRP');
    });

    it('retrieves Twelfth Schedule for verification fee queries', async () => {
      const result = await ragService.query({
        query: 'How much is statutory verification fee for retail counter scale?',
        language: 'en',
      });

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.answer.toLowerCase()).toMatch(/fee|counter scale|₹/);
    });

    it('synthesizes Hindi response when language is "hi"', async () => {
      const result = await ragService.query({
        query: 'तराजू का सत्यापन और मुहर कैसे करवाएं?',
        language: 'hi',
      });

      expect(result.language).toBe('hi');
      expect(result.answer).toContain('विधिक मापविज्ञान');
    });
  });

  describe('Chat API HTTP Endpoints (/api/v1/chat)', () => {
    it('POST /api/v1/chat/query returns structured response with citations & actions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/query',
        payload: {
          query: 'How to verify digital certificate with QR code?',
          language: 'en',
          portal_context: 'public',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.answer).toBeDefined();
      expect(Array.isArray(data.citations)).toBe(true);
      expect(Array.isArray(data.suggested_followups)).toBe(true);
      expect(typeof data.latency_ms).toBe('number');
    });

    it('GET /api/v1/chat/suggestions returns context-aware prompt chips', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/suggestions?context=trader',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(Array.isArray(data.suggestions)).toBe(true);
      expect(data.suggestions.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/chat/sources returns full list of indexed statutory acts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/sources',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.total).toBeGreaterThanOrEqual(10);
      expect(Array.isArray(data.sources)).toBe(true);
    });
  });
});

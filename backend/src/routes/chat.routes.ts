import { FastifyPluginAsync } from 'fastify';
import { ragService } from '../rag/rag.service.js';
import { RAGQueryRequest } from '../rag/types.js';

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // Automatically ensure knowledge base is seeded
  ragService.seedKnowledgeBase().catch((err) => {
    fastify.log.warn({ err }, 'Knowledge base seeding caught error');
  });

  // POST /api/v1/chat/query
  fastify.post<{
    Body: RAGQueryRequest;
  }>('/chat/query', async (request, reply) => {
    const body = request.body || { query: '' };
    const response = await ragService.query(body);
    return reply.send(response);
  });

  // GET /api/v1/chat/suggestions
  fastify.get<{
    Querystring: { context?: string };
  }>('/chat/suggestions', async (request, reply) => {
    const context = request.query.context;
    const suggestions = ragService.getSuggestions(context);
    return reply.send({ suggestions });
  });

  // GET /api/v1/chat/sources
  fastify.get('/chat/sources', async (_request, reply) => {
    const { STATUTORY_CORPUS } = await import('../rag/statutoryCorpus.js');
    const sources = STATUTORY_CORPUS.map((item) => ({
      category: item.category,
      act_name: item.act_name,
      section_rule_ref: item.section_rule_ref,
      title: item.title,
      citation_label: item.citation_label,
    }));
    return reply.send({ total: sources.length, sources });
  });
};

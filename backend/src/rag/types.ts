export type LegalCategory =
  | 'ACT'
  | 'GENERAL_RULES'
  | 'PACKAGED_COMMODITIES'
  | 'MODEL_APPROVAL'
  | 'GATC_RULES'
  | 'FEE_SCHEDULE'
  | 'PORTAL_FAQ'
  | 'PENALTIES_COMPOUNDING';

export interface StatutoryCitation {
  citation_id: string;
  act_or_rule: string;
  section_rule_ref: string;
  title: string;
  relevance_score: number;
  snippet: string;
}

export interface PortalActionLink {
  label: string;
  action_type: 'NAVIGATE' | 'OPEN_MODAL' | 'VERIFY_QR';
  target_tab?: 'trader' | 'public' | 'officer' | 'gatc' | 'supervisor' | 'admin';
  target_url?: string;
  description: string;
}

export interface RAGQueryRequest {
  query: string;
  language?: 'en' | 'hi';
  user_role?: string;
  portal_context?: string;
  history?: Array<{
    sender: 'user' | 'assistant';
    text: string;
  }>;
}

export interface RAGQueryResponse {
  answer: string;
  language: 'en' | 'hi';
  citations: StatutoryCitation[];
  portal_actions: PortalActionLink[];
  suggested_followups: string[];
  latency_ms: number;
  provider_used: 'GEMINI_API' | 'LOCAL_STATUTORY_RAG';
}

export interface StatutoryKnowledgeItem {
  category: LegalCategory;
  act_name: string;
  section_rule_ref: string;
  title: string;
  content: string;
  keywords: string[];
  citation_label: string;
  portal_action?: PortalActionLink;
}

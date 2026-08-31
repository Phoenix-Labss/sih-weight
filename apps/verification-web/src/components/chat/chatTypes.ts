export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: StatutoryCitation[];
  portal_actions?: PortalActionLink[];
  suggested_followups?: string[];
  provider_used?: 'GEMINI_API' | 'LOCAL_STATUTORY_RAG';
}

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

export interface RAGQueryResponse {
  answer: string;
  language: 'en' | 'hi';
  citations: StatutoryCitation[];
  portal_actions: PortalActionLink[];
  suggested_followups: string[];
  latency_ms: number;
  provider_used: 'GEMINI_API' | 'LOCAL_STATUTORY_RAG';
}

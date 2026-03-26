export type ApiCategory = 'contract' | 'service' | 'hook' | 'utility';
export type OutputFormat = 'json' | 'markdown' | 'html';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: unknown;
}

export interface ApiExample {
  title: string;
  description?: string;
  request?: string;
  response?: string;
  code: string;
}

export interface ApiVersion {
  version: string;
  date: string;
  breaking: boolean;
  changes: string[];
}

export interface ApiEndpoint {
  id: string;
  name: string;
  description: string;
  category: ApiCategory;
  version: string;
  deprecated?: boolean;
  params: ApiParam[];
  returns: { type: string; description: string };
  examples: ApiExample[];
  changelog: ApiVersion[];
  tags: string[];
  errors?: { code: string; description: string }[];
}

export interface FeedbackEntry {
  endpointId: string;
  helpful: boolean;
  comment?: string;
  timestamp: number;
}

export interface DocAnalyticsSummary {
  endpointId: string;
  views: number;
  copies: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

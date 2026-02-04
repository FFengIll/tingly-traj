// Types for CLI round extraction

export interface ThinkingMetadata {
  level?: string;
  disabled?: boolean;
  triggers?: unknown[];
}

export interface ClaudeRawEntry {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text: string }>;
  };
  isMeta?: boolean;
  thinkingMetadata?: ThinkingMetadata;
  [key: string]: unknown;
}

export interface RoundEntry {
  type: string;
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  rawContent: string;
  displayContent?: string;
}

export interface Round {
  roundNumber: number;
  startUuid: string;
  startTimestamp: string;
  endTimestamp: string;
  entries: RoundEntry[];
  summary: string;
}

export interface RoundListOutput {
  filePath: string;
  totalRounds: number;
  rounds: Array<{
    number: number;
    summary: string;
    entryCount: number;
    startTimestamp: string;
  }>;
}

// Types for OpenRouter record files
export interface RecordMessage {
  role: string;
  content: string | Array<RecordContentItem>;
}

export interface RecordContentItem {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface RecordRequestBody {
  max_tokens?: number;
  messages?: RecordMessage[];
  model?: string;
  stream?: boolean;
  system?: Array<{ type: string; text: string }>;
  tools?: unknown[];
  [key: string]: unknown;
}

export interface RecordRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: RecordRequestBody;
}

export interface RecordResponseContent {
  type: string;
  text?: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface RecordResponseBody {
  content?: RecordResponseContent[];
  id?: string;
  model?: string;
  role?: string;
  stop_reason?: string;
  type?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RecordResponse {
  status_code: number;
  headers: Record<string, string>;
  body: RecordResponseBody;
  is_streaming?: boolean;
}

export interface RecordEntry {
  timestamp: string;
  request_id: string;
  provider: string;
  scenario: string;
  model: string;
  request: RecordRequest;
  response: RecordResponse;
  duration_ms: number;
}

export interface RecordConversation {
  request: RecordEntry;
  messages: ConversationMessage[];
  timestamp: string;
  model: string;
  durationMs: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

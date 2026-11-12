export type UntrustedSourceType =
  'EMAIL' | 'WEB_PAGE' | 'GITHUB_ISSUE' | 'GITHUB_PR' | 'MCP_OUTPUT';

export interface InjectionDetectionResult {
  flagged: boolean;
  riskScore: number;
  signals: string[];
}

const INJECTION_RULES: Array<{ name: string; weight: number; pattern: RegExp }> = [
  {
    name: 'OVERRIDE_INSTRUCTIONS',
    weight: 35,
    pattern:
      /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)\b/i,
  },
  {
    name: 'SYSTEM_ROLE_SPOOF',
    weight: 30,
    pattern: /(^|\n)\s*(system|developer|assistant)\s*:\s*/i,
  },
  {
    name: 'BOUNDARY_TAG_ESCAPE',
    weight: 40,
    pattern: /<\/?\s*untrusted_external_data\b/i,
  },
  {
    name: 'TOOL_HIJACK_DIRECTIVE',
    weight: 30,
    pattern:
      /\b(call|invoke|execute|run)\s+(the\s+)?(tool|function|sendNotification|createGithubIssue|approveToolCall)\b/i,
  },
  {
    name: 'SECRET_EXFILTRATION',
    weight: 40,
    pattern:
      /\b(reveal|print|dump|exfiltrate|send)\b.{0,40}\b(api\s*key|token|secret|password|env|credentials?)\b/i,
  },
];

const INVISIBLE_UNICODE_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

export const detectPromptInjectionSignals = (text: string): InjectionDetectionResult => {
  const signals: string[] = [];
  let score = 0;

  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(text)) {
      signals.push(rule.name);
      score += rule.weight;
    }
  }

  const riskScore = Math.min(100, score);
  return {
    flagged: riskScore >= 30,
    riskScore,
    signals,
  };
};

export const sanitizeUntrustedContent = (rawContent: string, maxLength: number = 8000): string => {
  const strippedUnicode = rawContent.replace(INVISIBLE_UNICODE_REGEX, '');
  const escapedTags = strippedUnicode
    .replace(/<\s*untrusted_external_data\b/gi, '[escaped_tag:untrusted_external_data')
    .replace(/<\s*\/\s*untrusted_external_data\s*>/gi, '[/escaped_tag:untrusted_external_data]');

  return escapedTags.trim().slice(0, maxLength);
};

export const wrapUntrustedExternalData = (params: {
  sourceType: UntrustedSourceType;
  content: string;
  sourceId?: string;
  origin?: string;
  maxLength?: number;
}): string => {
  const sanitized = sanitizeUntrustedContent(params.content, params.maxLength ?? 8000);
  const detection = detectPromptInjectionSignals(params.content);
  const attrs = [
    `source="${params.sourceType}"`,
    'treat_as="UNTRUSTED_DATA_ONLY"',
    ...(params.sourceId ? [`id="${sanitizeAttribute(params.sourceId)}"`] : []),
    ...(params.origin ? [`origin="${sanitizeAttribute(params.origin)}"`] : []),
    ...(detection.flagged
      ? [`injection_warning="true" signals="${detection.signals.join(',')}"`]
      : []),
  ].join(' ');

  return `<untrusted_external_data ${attrs}>\n${sanitized}\n</untrusted_external_data>`;
};

const sanitizeAttribute = (value: string): string =>
  value.replace(/["<>]/g, '').replace(INVISIBLE_UNICODE_REGEX, '').slice(0, 160);

const SECRET_STRING_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g, replacement: '[REDACTED_GOOGLE_KEY]' },
  {
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, replacement: '[REDACTED_GITHUB_PAT]' },
  { pattern: /\bre_[A-Za-z0-9_]{16,}\b/g, replacement: '[REDACTED_RESEND_KEY]' },
  { pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  { pattern: /\bbot\d{6,}:[A-Za-z0-9_-]{20,}\b/g, replacement: 'bot[REDACTED_TELEGRAM_TOKEN]' },
  { pattern: /Bearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  {
    pattern: /\bv1\.[A-Za-z0-9+/=]{12,}\.[A-Za-z0-9+/=]{12,}\.[A-Za-z0-9+/=]{8,}\b/g,
    replacement: '[REDACTED_ENCRYPTED_CREDENTIALS]',
  },
];

const SENSITIVE_KEY_REGEX =
  /^(accessToken|refreshToken|botToken|apiKey|encryptedCredentials|secret|password|authorization|serviceRoleKey|privateKey|clientSecret)$/i;

export const redactSensitiveSecrets = (input: string): string => {
  let output = input;
  for (const rule of SECRET_STRING_PATTERNS) {
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output;
};

export const redactSecretsInObject = <T>(value: T, depth: number = 0): T => {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveSecrets(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsInObject(item, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object' && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (SENSITIVE_KEY_REGEX.test(key) && entry !== undefined && entry !== null) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSecretsInObject(entry, depth + 1);
      }
    }
    return sanitized as T;
  }

  return value;
};

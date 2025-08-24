export type ParsedResume = {
  personal_info?: {
    first_name?: string;
    last_name?: string;
    dob?: string;
    email?: string;
    phone?: string;
  };
  background_info?: {
    yoe?: number;
    summary?: string;
    interests?: string[];
  };
  skills?: string[];
  resume_summary?: string;
};

// small skill dictionary you can expand
const CANON_ALIASES: Record<string,string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  'node.js': 'Node.js',
  node: 'Node.js',
  sql: 'SQL',
  python: 'Python',
  react: 'React',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  fastapi: 'FastAPI',
  golang: 'Go',
  go: 'Go',
  java: 'Java',
  c: 'C',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
};

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?\d[\s-]?){7,}/;
const DOB = /\b(?:dob|date of birth)[:\s-]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})\b/i;
const YOE = /\b(\d{1,2})\s*(?:\+?\s*)?(?:years?|yrs?)\s+of\s+experience\b/i;

function pickSummary(text: string): string | undefined {
  // try "Summary" or "Profile" section; else first 2–3 sentences
  const m = /(?:^|\n)\s*(?:summary|profile)\s*[:\n]+([\s\S]{0,800})/i.exec(text);
  if (m) {
    const block = m[1].trim();
    return block.split(/\n{2,}/)[0].split(/(?<=\.)\s+/).slice(0,3).join(' ');
  }
  const first = text.trim().split(/(?<=\.)\s+/).slice(0,3).join(' ');
  return first || undefined;
}

function pickInterests(text: string): string[] | undefined {
  const m = /(?:^|\n)\s*interests?\s*[:\n]+([\s\S]{0,400})/i.exec(text);
  if (!m) return undefined;
  const block = m[1].split('\n')[0];
  const items = block.split(/[,•|]/).map(s=>s.trim()).filter(Boolean);
  if (!items.length) return undefined;
  return Array.from(new Set(items));
}

function pickSkills(text: string): string[] | undefined {
  // Prefer a Skills section
  let block: string | undefined;
  const m = /(?:^|\n)\s*skills?\s*[:\n]+([\s\S]{0,600})/i.exec(text);
  if (m) {
    block = m[1].split(/\n{2,}/)[0];
  } else {
    // fallback: scan whole text for known tokens
    block = text;
  }

  const tokens = block
    .split(/[\n,•|]/)
    .map(s=>s.trim().toLowerCase())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();

  for (const t of tokens) {
    const base = t.replace(/[^a-z0-9#+.]/g,''); // compress noise
    const canon = CANON_ALIASES[base] || CANON_ALIASES[t] || null;
    if (canon && !seen.has(canon.toLowerCase())) {
      seen.add(canon.toLowerCase());
      out.push(canon);
    }
  }
  return out.length ? out : undefined;
}

export function parseResume(text: string): ParsedResume {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Very naive name guess: first non-empty line w/ spaces and capitalized words
  const header = lines[0] || '';
  let first_name: string | undefined;
  let last_name: string | undefined;
  {
    const parts = header.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && /^[A-Z][a-zA-Z'-]+$/.test(parts[0])) {
      first_name = parts[0];
      last_name = parts.slice(1).join(' ');
    }
  }

  const email = (text.match(EMAIL) || [])[0];
  const phone = (text.match(PHONE) || [])[0];
  const dob = (DOB.exec(text)?.[1]) || undefined;
  const yoe = YOE.exec(text)?.[1] ? Number(RegExp.$1) : undefined;

  const summary = pickSummary(text);
  const interests = pickInterests(text);
  const skills = pickSkills(text);

  const out: ParsedResume = {};
  out.personal_info = {
    ...(first_name ? { first_name } : {}),
    ...(last_name ? { last_name } : {}),
    ...(dob ? { dob } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
  out.background_info = {
    ...(typeof yoe === 'number' ? { yoe } : {}),
    ...(summary ? { summary } : {}),
    ...(interests ? { interests } : {}),
  };
  if (skills) out.skills = skills;
  if (summary) out.resume_summary = summary;

  // prune empty objects
  if (Object.keys(out.personal_info ?? {}).length === 0) delete out.personal_info;
  if (Object.keys(out.background_info ?? {}).length === 0) delete out.background_info;

  return out;
}
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

// replace the YOE regex with a looser set of patterns
const YOE_PATTERNS: RegExp[] = [
  /\b(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\b(?:[^a-z]|$)/i,                // "3 years", "4 yrs", "2+ years"
  /\b(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\s*(?:of)?\s*experience\b/i,     // "3 years of experience"
  /\byoe\s*[:\-]?\s*(\d{1,2})\b/i,                                         // "yoe: 3"
];

function pickYOE(text: string): number | undefined {
  for (const re of YOE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

// broaden interests detection
function pickInterests(text: string): string[] | undefined {
  // 1) Explicit "Interests/Hobbies/Areas of interest"
  const m =
    /(?:^|\n)\s*(?:interests?|hobbies|areas?\s+of\s+interest)\s*[:\n]+([\s\S]{0,500})/i.exec(
      text
    );
  let block = "";
  if (m) {
    // take 1st paragraph after the heading
    block = m[1].split(/\n{2,}/)[0];
  } else {
    // 2) Heuristic in summary lines: "interested in|passionate about|focus on"
    const s = pickSummary(text) ?? "";
    const m2 =
      /(interested in|passionate about|focus(?:ed)? on)\s+([^.\n]{3,200})/i.exec(
        s
      );
    if (m2) block = m2[2];
  }

  if (!block) return undefined;

  const items = block
    .split(/[,•|;]|and/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length <= 50);

  if (!items.length) return undefined;
  return Array.from(new Set(items.map((s) => s.replace(/\s{2,}/g, " "))));
}

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

  // name guess (same as before) …
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
  const phone = ((text.match(PHONE) || [])[0] || '').trim();
  const dob = (DOB.exec(text)?.[1]) || undefined;
  const yoe = pickYOE(text);                       // <— use the new helper

  const summary = pickSummary(text);
  const interests = pickInterests(text);           // <— broader interests
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

  if (Object.keys(out.personal_info ?? {}).length === 0) delete out.personal_info;
  if (Object.keys(out.background_info ?? {}).length === 0) delete out.background_info;

  return out;
}
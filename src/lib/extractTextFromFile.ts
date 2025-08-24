// @ts-expect-error: Ignore type warnings for pdf-parse import
import pdf from 'pdf-parse/lib/pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromFile(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ct = file.type || '';

  // crude by mimetype/extension
  if (ct.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
    const out = await pdf(buf);
    return out.text || '';
  }
  if (ct.includes('word') || file.name.toLowerCase().endsWith('.docx')) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value || '';
  }

  // plaintext fallback
  return buf.toString('utf8');
}
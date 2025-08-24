import { NextResponse } from 'next/server';
import { db } from '../../../../../server/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { extractTextFromFile } from '@/lib/extractTextFromFile';
import { parseResume } from '@/lib/parseResume';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSkills(skills: string[] = []) {
    // basic normalizer: trim, lower for dedup, keep original casing from first seen
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of skills) {

        const s = String(raw).trim();
        if (!s) continue;
        const key = s.toLowerCase();
        
        if (!seen.has(key)) {
            seen.add(key);
            out.push(s);
        }
    }
    return out;
}

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get('file');
        const userId = String(form.get('userId') || '').trim();
        const mode = String(form.get('skillsMode') || 'add') as 'add'|'replace';

        if (!userId) {
            return NextResponse.json({ ok:false, error:'Missing userId' }, { status:400 });
        }
        if (!(file instanceof File)) {
            return NextResponse.json({ ok:false, error:'Missing file' }, { status:400 });
        }

        // 1) Extract text
        const text = await extractTextFromFile(file);
        if (!text.trim()) {
            return NextResponse.json({ ok:false, error:'Could not read resume text' }, { status:422 });
        }

        // 2) Parse
        const parsed = parseResume(text);

        // 3) Build a patch limited to the allowed fields only
        const patch: Partial<{
            personal_info: unknown;
            background_info: unknown;
            resume_summary: unknown;
        }> = {};

        if (parsed.personal_info)   patch.personal_info   = parsed.personal_info;
        if (parsed.background_info) patch.background_info = parsed.background_info;
        if (parsed.resume_summary)  patch.resume_summary  = parsed.resume_summary;

        // 4) Write to Firestore
        const ref = db.collection('jobseekers').doc(userId);

        // 4a) scalars & map fields
        if (Object.keys(patch).length) {
            await ref.set(patch, { merge: true });
        }

        // ---- Skills handling ---------------------------------------------------
        const parsedSkills = normalizeSkills(parsed.skills || []);

        if (mode === 'replace') {
            // ALWAYS overwrite, even if parser found nothing
            await ref.set({ skills: parsedSkills }, { merge: true }); 
        } else if (mode === 'add' && parsedSkills.length) {
            // add (unique) — do a read to avoid case-duplication
            const snap = await ref.get();
            const cur: string[] = (snap.data()?.skills || []).filter((s: unknown): s is string => typeof s === 'string');
            const curSet = new Set(cur.map(s => s.toLowerCase()));
            const toAdd = parsedSkills.filter(s => !curSet.has(s.toLowerCase()));
            if (toAdd.length) {
                await ref.update({ skills: FieldValue.arrayUnion(...toAdd) });
            }
        }
        
        // -----------------------------------------------------------------------
        return NextResponse.json({
            ok: true,
            parsed,
            skillsApplied: { mode, resulting: mode === 'replace' ? parsedSkills : undefined }
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ ok:false, error: String((err as Error)?.message || err) }, { status:500 });
    }
}
import { NextResponse } from 'next/server';
import prisma from '../../../lib/db.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const vkey = (body.vkey || '').trim();
    const reason = (body.reason || '').trim();
    const details = (body.details || '').trim() || null;

    if (!vkey || !reason) {
      return NextResponse.json({ error: 'vkey and reason are required' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        vkey,
        reason,
        details,
      },
    });

    return NextResponse.json({ ok: true, id: report.id }, { status: 201 });
  } catch (err) {
    console.error('[report API] error:', err);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}

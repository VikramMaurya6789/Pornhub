import { NextResponse } from 'next/server';
import { destroySession } from '../../../../lib/auth.js';

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

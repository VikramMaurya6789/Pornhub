import { NextResponse } from 'next/server';
import { getGoogleConfig } from '../../../../lib/auth.js';

// GET /api/auth/providers -> which sign-in methods are available
export async function GET() {
  const { configured } = getGoogleConfig();
  return NextResponse.json({
    google: configured,
    phone: true,
    email: true,
  });
}

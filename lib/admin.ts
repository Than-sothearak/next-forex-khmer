import { NextRequest, NextResponse } from 'next/server';
export function requireAdmin(request: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !supplied || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

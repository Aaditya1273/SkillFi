import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

async function handler(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { pathname, search } = new URL(req.url);
  const slug = pathname.replace('/api/referrals/', '');
  const backendUrl = `${process.env.AUTH_SERVICE_URL}/api/referrals/${slug}${search}`;

  try {
    const options: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
    };

    if (req.method !== 'GET' && req.body) {
      options.body = req.body;
    }

    const response = await fetch(backendUrl, options);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Referral API proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export { handler as GET, handler as POST };

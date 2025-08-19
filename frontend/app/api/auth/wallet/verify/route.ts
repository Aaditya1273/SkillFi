import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, signature, address } = await request.json();

    if (!message || !signature || !address) {
      return NextResponse.json({ error: 'Message, signature, and address are required' }, { status: 400 });
    }

    // Forward to auth service
    const response = await fetch(`${process.env.AUTH_SERVICE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, signature, address }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.message || 'Wallet verification failed' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Wallet verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

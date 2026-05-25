import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// Fallback credentials
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123@';
const JWT_SECRET = process.env.JWT_SECRET || 'formulario-super-secret-key-123456';

// GET check session
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ loggedIn: false }, { status: 200 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return NextResponse.json({ loggedIn: true, user: decoded.username }, { status: 200 });
    } catch (err) {
      console.error('JWT verification failed:', err);
      // Remove invalid token
      const response = NextResponse.json({ loggedIn: false }, { status: 200 });
      response.cookies.delete('auth_token');
      return response;
    }
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST login or logout
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, username, password } = body;

    // Handle logout
    if (action === 'logout') {
      const response = NextResponse.json({ success: true, message: 'Logged out' }, { status: 200 });
      const cookieStore = await cookies();
      cookieStore.set('auth_token', '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      return response;
    }

    // Handle login
    const adminUser = process.env.ADMIN_USER || DEFAULT_USER;
    const adminPass = process.env.ADMIN_PASS || DEFAULT_PASS;

    if (username === adminUser && password === adminPass) {
      // Create JWT
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1d' });
      
      const response = NextResponse.json({ success: true, user: username }, { status: 200 });
      
      const cookieStore = await cookies();
      cookieStore.set('auth_token', token, {
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      return response;
    }

    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  } catch (error) {
    console.error('Auth endpoint error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

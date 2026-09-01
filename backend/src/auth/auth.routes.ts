import { FastifyPluginAsync } from 'fastify';
import { authService, RegisterInput } from './auth.service.js';
import { otpService } from './otp.service.js';
import {
  REFRESH_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_TOKEN_TTL_SECONDS,
  parseCookies,
  serializeCookie,
} from './token.js';
import { ValidationError, ForbiddenError } from '../core/errors.js';

const isProd = process.env.NODE_ENV === 'production';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict' as const,
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: 'Strict' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

function readCookie(request: { headers: Record<string, string | string[] | undefined> }, name: string): string | undefined {
  const header = request.headers.cookie;
  const parsed = parseCookies(Array.isArray(header) ? header[0] : header);
  return parsed[name];
}

function bearerToken(request: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const auth = request.headers.authorization;
  const value = Array.isArray(auth) ? auth[0] : auth;
  if (value?.startsWith('Bearer ')) return value.slice(7);
  return undefined;
}

function verifyCsrf(request: { headers: Record<string, string | string[] | undefined> }): void {
  const cookieCsrf = readCookie(request, CSRF_COOKIE);
  const header = request.headers[CSRF_HEADER];
  const headerCsrf = Array.isArray(header) ? header[0] : header;
  if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
    throw new ForbiddenError('CSRF validation failed', 'CSRF_MISMATCH');
  }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/auth/register (New User & Trader Registration)
  fastify.post<{ Body: RegisterInput }>(
    '/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } },
    async (request, reply) => {
      const body = request.body;
      if (!body) throw new ValidationError('Registration payload is required');

      const result = await authService.register(body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });

      reply.header('set-cookie', [
        serializeCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions()),
        serializeCookie(CSRF_COOKIE, result.csrf, csrfCookieOptions()),
      ]);
      return { accessToken: result.accessToken, user: result.user };
    }
  );

  // POST /api/v1/auth/login
  fastify.post<{ Body: { email?: string; password?: string } }>(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const email = request.body?.email?.trim().toLowerCase();
      const password = request.body?.password;
      if (!email || !password) throw new ValidationError('email and password are required');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Invalid email format');

      const result = await authService.login(email, password, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });

      reply.header('set-cookie', [
        serializeCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions()),
        serializeCookie(CSRF_COOKIE, result.csrf, csrfCookieOptions()),
      ]);
      return { accessToken: result.accessToken, user: result.user };
    }
  );

  // POST /api/v1/auth/send-otp
  fastify.post<{ Body: { target?: string; purpose?: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET' } }>(
    '/auth/send-otp',
    { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } },
    async (request) => {
      const target = request.body?.target;
      const purpose = request.body?.purpose || 'REGISTRATION';
      if (!target) throw new ValidationError('target (email or mobile) is required');

      return await otpService.sendOtp(target, purpose);
    }
  );

  // POST /api/v1/auth/verify-otp
  fastify.post<{ Body: { target?: string; code?: string; purpose?: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET' } }>(
    '/auth/verify-otp',
    async (request) => {
      const target = request.body?.target;
      const code = request.body?.code;
      const purpose = request.body?.purpose || 'REGISTRATION';
      if (!target || !code) throw new ValidationError('target and OTP code are required');

      const verified = await otpService.verifyOtp(target, code, purpose);
      return { verified, message: 'OTP verified successfully' };
    }
  );

  // POST /api/v1/auth/check-availability
  fastify.post<{ Body: { type?: 'email' | 'identifier'; value?: string; tenantId?: string } }>(
    '/auth/check-availability',
    async (request) => {
      const type = request.body?.type;
      const value = request.body?.value;
      if (!type || !value) throw new ValidationError('type and value are required');
      if (type !== 'email' && type !== 'identifier') throw new ValidationError('type must be email or identifier');

      return await authService.checkAvailability(type, value, request.body?.tenantId);
    }
  );

  // POST /api/v1/auth/refresh
  fastify.post('/auth/refresh', async (request, reply) => {
    verifyCsrf(request);
    const oldToken = readCookie(request, REFRESH_COOKIE);
    if (!oldToken) throw new ValidationError('No refresh token present');

    const result = await authService.rotateRefresh(oldToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string,
    });

    reply.header('set-cookie', [
      serializeCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions()),
      serializeCookie(CSRF_COOKIE, result.csrf, csrfCookieOptions()),
    ]);
    return { accessToken: result.accessToken, user: result.user };
  });

  // POST /api/v1/auth/logout
  fastify.post('/auth/logout', async (request, reply) => {
    verifyCsrf(request);
    const token = readCookie(request, REFRESH_COOKIE);
    if (token) await authService.logout(token);
    reply.header('set-cookie', [
      serializeCookie(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 }),
      serializeCookie(CSRF_COOKIE, '', { ...csrfCookieOptions(), maxAge: 0 }),
    ]);
    return { ok: true };
  });

  // GET /api/v1/auth/me
  fastify.get('/auth/me', async (request, reply) => {
    const token = bearerToken(request);
    if (!token) throw new ValidationError('Access token missing');
    const { verifyAccessToken } = await import('./token.js');
    const secret =
      process.env.JWT_SECRET_KEY ||
      (process.env.NODE_ENV !== 'production' ? 'dev-fallback-jwt-secret-for-testing-only' : '');
    const claims = verifyAccessToken(token, secret);
    return { user: await authService.me(claims.sub) };
  });

  // POST /api/v1/auth/password
  fastify.post<{ Body: { current_password?: string; new_password?: string } }>('/auth/password', async (request, reply) => {
    const token = bearerToken(request);
    if (!token) throw new ValidationError('Access token missing');
    const { verifyAccessToken } = await import('./token.js');
    const secret =
      process.env.JWT_SECRET_KEY ||
      (process.env.NODE_ENV !== 'production' ? 'dev-fallback-jwt-secret-for-testing-only' : '');
    const claims = verifyAccessToken(token, secret);
    await authService.changePassword(claims.sub, request.body?.current_password || '', request.body?.new_password || '');
    return { ok: true };
  });
};
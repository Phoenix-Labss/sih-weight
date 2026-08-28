import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const L = '/api/v1/auth';

let app;

function pc(sc) {
  const o = {};
  if (!sc) return o;
  const a = Array.isArray(sc) ? sc : [sc];
  for (const e of a) { const i = e.indexOf('='); if (i > 0) o[e.slice(0,i).trim()] = decodeURIComponent(e.slice(i+1, e.indexOf(';') > 0 ? e.indexOf(';') : undefined)); }
  return o;
}

async function login(e, p) {
  const r = await app.inject({ method: 'POST', url: L+'/login', payload: { email: e, password: p } });
  expect(r.statusCode).toBe(200);
  const b = JSON.parse(r.body);
  const c = pc(r.headers['set-cookie']);
  return { at: b.accessToken, c: c, cs: c['lm_csrf'] || '' };
}

describe('Auth Suite', () => {
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  describe('POST login', () => {
    it('trader ok', async () => {
      const r = await app.inject({ method: 'POST', url: L+'/login', payload: { email: 'trader@example.com', password: 'Trader@2026' } });
      expect(r.statusCode).toBe(200);
      expect(JSON.parse(r.body).accessToken).toBeTruthy();
    });
    it('wrong pw 401', async () => {
      const r = await app.inject({ method: 'POST', url: L+'/login', payload: { email: 'trader@example.com', password: 'x' } });
      expect(r.statusCode).toBe(401);
    });
    it('no user 401', async () => {
      const r = await app.inject({ method: 'POST', url: L+'/login', payload: { email: 'nobody@x.com', password: 'x' } });
      expect(r.statusCode).toBe(401);
    });
  });

  describe('GET me', () => {
    it('me from token', async () => {
      const { at } = await login('trader@example.com','Trader@2026');
      const r = await app.inject({ method: 'GET', url: L+'/me', headers: { authorization: 'Bearer '+at } });
      expect(r.statusCode).toBe(200);
      expect(JSON.parse(r.body).user.email).toBe('trader@example.com');
    });
    it('bad token fails', async () => {
      const r = await app.inject({ method: 'GET', url: L+'/me', headers: { authorization: 'Bearer bad' } });
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST refresh + CSRF', () => {
    it('rotate ok', async () => {
      const { c: { lm_refresh }, cs } = await login('trader@example.com','Trader@2026');
      const r = await app.inject({ method: 'POST', url: L+'/refresh', cookies: { lm_refresh, lm_csrf: cs }, headers: { 'x-csrf-token': cs } });
      expect(r.statusCode).toBe(200);
    });
    it('no CSRF 403', async () => {
      const { c: { lm_refresh } } = await login('trader@example.com','Trader@2026');
      const r = await app.inject({ method: 'POST', url: L+'/refresh', cookies: { lm_refresh } });
      expect(r.statusCode).toBe(403);
    });
  });

  describe('POST logout', () => {
    it('logout ok', async () => {
      const { c: { lm_refresh }, cs } = await login('trader@example.com','Trader@2026');
      const r = await app.inject({ method: 'POST', url: L+'/logout', cookies: { lm_refresh, lm_csrf: cs }, headers: { 'x-csrf-token': cs } });
      expect(r.statusCode).toBe(200);
    });
  });

  describe('POST password', () => {
    it('change pw', async () => {
      const { at } = await login('trader@example.com','Trader@2026');
      await app.inject({ method: 'POST', url: L+'/password', headers: { authorization: 'Bearer '+at }, payload: { current_password: 'Trader@2026', new_password: 'New1@pass' } });
      const r1 = await app.inject({ method: 'POST', url: L+'/login', payload: { email: 'trader@example.com', password: 'New1@pass' } });
      expect(r1.statusCode).toBe(200);
      const { at: at2 } = await login('trader@example.com','New1@pass');
      await app.inject({ method: 'POST', url: L+'/password', headers: { authorization: 'Bearer '+at2 }, payload: { current_password: 'New1@pass', new_password: 'Trader@2026' } });
    });
  });

  describe('POST register (Government & Small Business Trader Registration)', () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const testEmail = `trader_${randomSuffix}_${Date.now()}@delhitraders.org`;
    const testGstin = `07AAAAA${Math.floor(1000 + Math.random() * 9000)}A1Z5`;
    const testSmallVendorEmail = `kirana_${randomSuffix}_${Date.now()}@delhishop.in`;

    it('successfully registers commercial trader with GSTIN and returns active session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: testEmail,
          password: 'SecureTrader@2026',
          fullName: 'Vikram Malhotra',
          phone: '9811002233',
          legalName: 'Malhotra Weighing Solutions Pvt Ltd',
          tradeName: 'Malhotra Scales & Weighing Co',
          stakeholderType: 'OWNER_USER',
          identifierType: 'GSTIN',
          identifierValue: testGstin,
          addressLine1: 'Shop 42, Chandni Chowk Market',
          city: 'New Delhi',
          district: 'Central Delhi',
          pincode: '110006',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeTruthy();
      expect(body.user.email).toBe(testEmail.toLowerCase());
      expect(body.user.role).toBe('OWNER');
      expect(body.user.organizationName).toBe('Malhotra Scales & Weighing Co');

      // Check cookies
      const cookies = pc(res.headers['set-cookie']);
      expect(cookies['lm_refresh']).toBeTruthy();
      expect(cookies['lm_csrf']).toBeTruthy();
    });

    it('successfully registers small vendor/kirana store without mandatory GSTIN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: testSmallVendorEmail,
          password: 'KiranaShop@2026',
          fullName: 'Ramesh Kumar',
          phone: '9876543210',
          tradeName: 'Ramesh Kirana Store',
          addressLine1: 'Plot 12, Subzi Mandi',
          city: 'New Delhi',
          pincode: '110007',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeTruthy();
      expect(body.user.email).toBe(testSmallVendorEmail.toLowerCase());
      expect(body.user.role).toBe('OWNER');
    });

    it('rejects registration with weak password (CERT-In compliance)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: `weak_${Date.now()}@example.com`,
          password: 'weakpassword',
          fullName: 'Weak Pass User',
          phone: '9811002233',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.body).errorCode).toBe('WEAK_PASSWORD');
    });

    it('rejects registration with invalid Indian phone number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: `badphone_${Date.now()}@example.com`,
          password: 'ValidPassword@2026',
          fullName: 'Bad Phone User',
          phone: '12345',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.body).errorCode).toBe('INVALID_PHONE');
    });

    it('rejects registration with invalid GSTIN format when provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: `badgstin_${Date.now()}@example.com`,
          password: 'ValidPassword@2026',
          fullName: 'Bad GSTIN User',
          phone: '9811002233',
          identifierType: 'GSTIN',
          identifierValue: 'INVALID-GST-NUMBER',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.body).errorCode).toBe('INVALID_GSTIN');
    });

    it('rejects duplicate registration with already registered email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: L + '/register',
        payload: {
          email: testEmail,
          password: 'AnotherPassword@2026',
          fullName: 'Duplicate User',
          phone: '9811002233',
        },
      });
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).errorCode).toBe('EMAIL_EXISTS');
    });
  });

  describe('OTP & Availability Check Endpoints', () => {
    it('sends OTP and verifies successfully', async () => {
      const targetEmail = `otp_test_${Date.now()}@gov.in`;

      // Send OTP
      const sendRes = await app.inject({
        method: 'POST',
        url: L + '/send-otp',
        payload: { target: targetEmail, purpose: 'REGISTRATION' },
      });
      expect(sendRes.statusCode).toBe(200);
      expect(JSON.parse(sendRes.body).success).toBe(true);

      // Verify availability
      const availRes = await app.inject({
        method: 'POST',
        url: L + '/check-availability',
        payload: { type: 'email', value: targetEmail },
      });
      expect(availRes.statusCode).toBe(200);
      expect(JSON.parse(availRes.body).available).toBe(true);

      const existingAvail = await app.inject({
        method: 'POST',
        url: L + '/check-availability',
        payload: { type: 'email', value: 'trader@example.com' },
      });
      expect(existingAvail.statusCode).toBe(200);
      expect(JSON.parse(existingAvail.body).available).toBe(false);
    });
  });
});
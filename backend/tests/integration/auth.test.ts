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
});
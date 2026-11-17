import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAtomicTicket,
  hashPassword,
  signSessionToken,
  TicketLockManager,
  verifyPassword,
  verifySessionToken,
} from './cryptoUtils';

test('hashPassword and verifyPassword never store plaintext and verify accurately', () => {
  const hash = hashPassword('AmpelDesa2026!');
  assert.equal(hash.includes('AmpelDesa2026!'), false);
  assert.equal(verifyPassword('AmpelDesa2026!', hash), true);
  assert.equal(verifyPassword('WrongPassword', hash), false);
});

test('signSessionToken and verifySessionToken enforce integrity and expiration', () => {
  const token = signSessionToken(
    {
      idUser: 'USR-1',
      username: 'admin',
      namaLengkap: 'Admin Desa',
      role: 'SUPER_ADMIN',
      noHp: '08123456789',
      statusAkun: 'AKTIF',
    },
    60_000
  );
  const decoded = verifySessionToken(token);
  assert.ok(decoded);
  assert.equal(decoded?.role, 'SUPER_ADMIN');

  const tampered = `${token}x`;
  assert.equal(verifySessionToken(tampered), null);

  const expired = signSessionToken(
    {
      idUser: 'USR-1',
      username: 'admin',
      namaLengkap: 'Admin Desa',
      role: 'SUPER_ADMIN',
      noHp: '08123456789',
      statusAkun: 'AKTIF',
    },
    -1000
  );
  assert.equal(verifySessionToken(expired), null);
});

test('concurrent generateAtomicTicket never produces duplicate ticket numbers (Acceptance Test #14)', async () => {
  const lock = new TicketLockManager();
  let counter = 100;

  // Simulate 50 concurrent citizen submissions with async delays
  const tasks = Array.from({ length: 50 }, (_, idx) =>
    generateAtomicTicket(
      lock,
      () => counter,
      (next) => {
        counter = next;
      },
      2026
    ).then(async (ticket) => {
      if (idx % 3 === 0) await new Promise((r) => setTimeout(r, 1));
      return ticket;
    })
  );

  const tickets = await Promise.all(tasks);
  const unique = new Set(tickets);
  assert.equal(tickets.length, 50);
  assert.equal(unique.size, 50);
  assert.equal(counter, 150);
  assert.equal(tickets[0], 'SW-2026-000101');
  assert.equal(tickets[49], 'SW-2026-000150');
});

import { describe, expect, it } from 'vitest';
import { readClaim, readScan } from '../src/game/stamp-store';

describe('unverified QR handoff', () => {
  it('parses a known spot and normalizes a key without pretending to verify it', () => {
    expect(readClaim(new URLSearchParams('spot=taichi&k=unverified-code'))).toEqual({
      spot: 'taichi',
      key: 'UNVERIFIED-CODE',
    });
    expect(readClaim(new URLSearchParams('spot=zhongda-lake&k=GATE-26'))?.spot).toBe(
      'zhongda-lake',
    );
  });
  it('rejects malformed handoffs and unknown spots', () => {
    for (const query of ['spot=lake&k=A', 'spot=taichi', 'spot=taichi&k=<script>', ''])
      expect(readClaim(new URLSearchParams(query))).toBeNull();
  });
});

describe('scanned QR codes', () => {
  it('reads stamp links on any host, query-style links and bare codes', () => {
    expect(readScan('https://play.example.org/stamp/taichi?k=abc-123')).toEqual({
      claim: { spot: 'taichi', key: 'ABC-123' },
    });
    expect(readScan('http://localhost:8080/game?spot=baihua&k=X1')).toEqual({
      claim: { spot: 'baihua', key: 'X1' },
    });
    expect(readScan('  taichi-0123abcd  ')).toEqual({ code: 'TAICHI-0123ABCD' });
  });
  it('ignores anything else', () => {
    for (const text of [
      'https://evil.example/stamp/unknown?k=A',
      'https://example.org/',
      'javascript:alert(1)',
      '請到兌獎處',
      '',
    ])
      expect(readScan(text)).toBeNull();
  });
});

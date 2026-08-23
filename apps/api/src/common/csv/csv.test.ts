import { describe, expect, it } from 'bun:test';
import { parseCsv, parseCsvObjects, toCsv } from './csv.js';

describe('csv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and quotes', () => {
    const text = 'name,note\n"Rice, white","He said ""hi"""';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Rice, white', 'He said "hi"'],
    ]);
  });

  it('handles embedded newlines inside quotes and CRLF endings', () => {
    const text = 'a,b\r\n"line1\nline2",x\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'x'],
    ]);
  });

  it('parses into objects keyed by header', () => {
    const rows = parseCsvObjects('name,price\nSugar,3000\nSalt,1500');
    expect(rows).toEqual([
      { name: 'Sugar', price: '3000' },
      { name: 'Salt', price: '1500' },
    ]);
  });

  it('round-trips through toCsv/parseCsv', () => {
    const data = [
      ['name', 'note'],
      ['Rice, white', 'a "quoted" bit'],
      ['Plain', ''],
    ];
    expect(parseCsv(toCsv(data))).toEqual(data);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseIndodaxFrame,
  parsePhoenixFrame,
  parseRekuBook,
  parseTokocryptoDelta,
} from '@server/live/protocols.js';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/live/${name}`, import.meta.url)), 'utf8');
}

describe('live protocol runtime schemas', () => {
  it('recognizes the documented Indodax authentication reply', () => {
    expect(
      parseIndodaxFrame('{"id":1,"result":{"client":"public-client","version":"2.8.6"}}'),
    ).toMatchObject({ kind: 'reply', value: { result: { client: 'public-client' } } });
  });

  it('parses an Indodax full snapshot without converting decimals through Number', () => {
    const frame = parseIndodaxFrame(fixture('indodax-orderbook.json'));
    expect(frame).toEqual({
      kind: 'publication',
      value: {
        channel: 'market:order-book-btcidr',
        pair: 'btcidr',
        offset: '67409',
        bids: [{ price: '999', quantity: '0.3' }],
        asks: [{ price: '1001', quantity: '0.2' }],
      },
    });
  });

  it('parses Phoenix object frames and treats Reku order data as a complete book', () => {
    const frame = parsePhoenixFrame(fixture('reku-orderbook.json'));
    const book = parseRekuBook(frame.payload, '1');
    expect(frame).toMatchObject({ topic: 'order:1', event: 'data' });
    expect(book).toEqual({
      bids: [{ price: '999', quantity: '1.5' }],
      asks: [{ price: '1001', quantity: '1.25' }],
    });
    expect(() => parseRekuBook(frame.payload, '2')).toThrow('reku_coin_id_mismatch');
  });

  it('accepts the documented combined Tokocrypto wrapper and rejects wrong event types', () => {
    expect(parseTokocryptoDelta(fixture('tokocrypto-depth.json'))).toMatchObject({
      s: 'BTCIDR',
      U: '101',
      u: '102',
    });
    expect(() =>
      parseTokocryptoDelta('{"e":"trade","E":1,"s":"BTCIDR","U":1,"u":1,"b":[],"a":[]}'),
    ).toThrow();
  });
});

import { z } from 'zod';
import { parsePublicJsonText } from '@server/adapters/http.js';
import type { BookLevel } from '@server/domain/types.js';

const decimalToken = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const integerToken = z.string().regex(/^\d+$/);

const indodaxLevelSchema = z
  .object({
    price: decimalToken,
    btc_volume: decimalToken.optional(),
    idr_volume: decimalToken.optional(),
  })
  .catchall(decimalToken);
const indodaxPublicationSchema = z.object({
  result: z.object({
    channel: z.string(),
    data: z.object({
      data: z.object({
        pair: z.string(),
        ask: z.array(indodaxLevelSchema),
        bid: z.array(indodaxLevelSchema),
      }),
      offset: integerToken,
    }),
  }),
});
const indodaxReplySchema = z.object({
  id: integerToken,
  result: z
    .object({
      client: z.string().optional(),
      recoverable: z.boolean().optional(),
      epoch: z.string().optional(),
      offset: integerToken.optional(),
      publications: z.array(z.unknown()).optional(),
    })
    .passthrough()
    .optional(),
  error: z.unknown().optional(),
});

export type IndodaxPublication = {
  channel: string;
  pair: string;
  offset: string;
  bids: BookLevel[];
  asks: BookLevel[];
};

export function parseIndodaxFrame(
  text: string,
):
  | { kind: 'publication'; value: IndodaxPublication }
  | { kind: 'reply'; value: z.infer<typeof indodaxReplySchema> } {
  const raw = parsePublicJsonText(text);
  const publication = indodaxPublicationSchema.safeParse(raw);
  if (publication.success) {
    const pair = publication.data.result.data.data.pair.toLowerCase();
    const quantityField = `${pair.slice(0, -3)}_volume`;
    const map = (levels: Array<Record<string, string | undefined>>): BookLevel[] =>
      levels.map((level) => {
        const quantity = level[quantityField] ?? level.btc_volume;
        if (!quantity) throw new Error('indodax_quantity_field_missing');
        return { price: level.price!, quantity };
      });
    return {
      kind: 'publication',
      value: {
        channel: publication.data.result.channel,
        pair,
        offset: publication.data.result.data.offset,
        bids: map(publication.data.result.data.data.bid),
        asks: map(publication.data.result.data.data.ask),
      },
    };
  }
  return { kind: 'reply', value: indodaxReplySchema.parse(raw) };
}

const rekuEntrySchema = z.tuple([decimalToken, decimalToken, decimalToken]);
const rekuPayloadSchema = z.object({
  i: z.union([integerToken, z.number().int().nonnegative().transform(String)]),
  bs: z.object({ b: z.array(rekuEntrySchema), s: z.array(rekuEntrySchema) }),
});
const phoenixObjectSchema = z.object({
  topic: z.string(),
  event: z.string(),
  payload: z.unknown(),
  ref: z.union([z.string(), z.null()]).optional(),
});
const phoenixArraySchema = z.tuple([
  z.union([z.string(), z.null()]),
  z.union([z.string(), z.null()]),
  z.string(),
  z.string(),
  z.unknown(),
]);

export type PhoenixFrame = {
  joinRef: string | null;
  ref: string | null;
  topic: string;
  event: string;
  payload: unknown;
};

export function parsePhoenixFrame(text: string): PhoenixFrame {
  const raw = parsePublicJsonText(text);
  const array = phoenixArraySchema.safeParse(raw);
  if (array.success) {
    const [joinRef, ref, topic, event, payload] = array.data;
    return { joinRef, ref, topic, event, payload };
  }
  const object = phoenixObjectSchema.parse(raw);
  return {
    joinRef: null,
    ref: object.ref ?? null,
    topic: object.topic,
    event: object.event,
    payload: object.payload,
  };
}

export function parseRekuBook(
  payload: unknown,
  expectedCoinId: string,
): {
  bids: BookLevel[];
  asks: BookLevel[];
} {
  const book = rekuPayloadSchema.parse(payload);
  if (book.i !== expectedCoinId) throw new Error('reku_coin_id_mismatch');
  const map = (entries: Array<[string, string, string]>): BookLevel[] =>
    entries.map(([, price, quantity]) => ({ price, quantity }));
  return { bids: map(book.bs.b), asks: map(book.bs.s) };
}

const tokocryptoDeltaSchema = z.object({
  e: z.literal('depthUpdate'),
  E: integerToken,
  s: z.string(),
  U: integerToken,
  u: integerToken,
  b: z.array(z.tuple([decimalToken, decimalToken])),
  a: z.array(z.tuple([decimalToken, decimalToken])),
});
const tokocryptoWrapperSchema = z.object({ stream: z.string(), data: z.unknown() });

export type TokocryptoDelta = z.infer<typeof tokocryptoDeltaSchema>;

export function parseTokocryptoDelta(text: string): TokocryptoDelta {
  const raw = parsePublicJsonText(text);
  const wrapper = tokocryptoWrapperSchema.safeParse(raw);
  return tokocryptoDeltaSchema.parse(wrapper.success ? wrapper.data.data : raw);
}

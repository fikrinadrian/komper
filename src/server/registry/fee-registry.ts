import type { FeeAssumption, Venue } from '@shared/contracts.js';

// Product/legal has not approved a public fee source yet. Keep this registry explicit and
// fail closed: the comparison service can calculate net values once a VERIFIED entry is added.
const registry: Record<Venue, FeeAssumption> = {
  INDODAX: { status: 'UNVERIFIED' },
  REKU: { status: 'UNVERIFIED' },
  TOKOCRYPTO: { status: 'UNVERIFIED' },
};

export function getFeeAssumption(venue: Venue): FeeAssumption {
  return registry[venue];
}

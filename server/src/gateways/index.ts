import type { PaymentGateway } from './types';
import { TapGateway } from './tap';
import { MyFatoorahGateway } from './myfatoorah';
import { MockGateway } from './mock';

export * from './types';

const gateways: Record<string, () => PaymentGateway> = {
  tap: () => new TapGateway(),
  myfatoorah: () => new MyFatoorahGateway(),
  mock: () => new MockGateway(),
};

export function getGateway(): PaymentGateway {
  const configured = (process.env.PAYMENT_PROVIDER || 'tap').toLowerCase();

  if (configured === 'tap' && !process.env.TAP_SECRET_KEY) return gateways.mock();
  if (configured === 'myfatoorah' && !process.env.MYFATOORAH_API_KEY) return gateways.mock();

  const factory = gateways[configured];
  if (!factory) throw new Error(`Unknown PAYMENT_PROVIDER: ${configured}`);
  return factory();
}

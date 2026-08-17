import type { CreatePaymentParams, CreatePaymentResult, PaymentGateway, VerifyPaymentResult } from './types';

// Fallback used only when no real gateway credentials are configured, so the
// app still runs out of the box. Always "succeeds" instantly — never used
// once TAP_SECRET_KEY or MYFATOORAH_API_KEY is set.
export class MockGateway implements PaymentGateway {
  name = 'mock';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const ref = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return { redirectUrl: `${params.callbackUrl}${params.callbackUrl.includes('?') ? '&' : '?'}mock=1`, providerRef: ref };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    return { paid: providerRef.startsWith('MOCK-'), status: 'CAPTURED', raw: { mock: true } };
  }
}

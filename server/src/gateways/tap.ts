import type { CreatePaymentParams, CreatePaymentResult, PaymentGateway, VerifyPaymentResult } from './types';

const BASE_URL = process.env.TAP_BASE_URL || 'https://api.tap.company/v2';

function secretKey(): string {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) throw new Error('TAP_SECRET_KEY is not configured');
  return key;
}

export class TapGateway implements PaymentGateway {
  name = 'tap';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const res = await fetch(`${BASE_URL}/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(params.amount.toFixed(3)),
        currency: params.currency.toUpperCase(),
        customer: {
          first_name: params.customerName || 'Customer',
          email: params.customerEmail || 'no-reply@tahdani.app',
          ...(params.customerPhone ? { phone: { country_code: '973', number: params.customerPhone.replace(/\D/g, '').slice(-8) } } : {}),
        },
        source: { id: 'src_all' },
        redirect: { url: params.callbackUrl },
        ...(params.webhookUrl ? { post: { url: params.webhookUrl } } : {}),
        description: params.description,
        reference: { order: params.purchaseId },
      }),
    });

    const data = (await res.json()) as { id?: string; transaction?: { url?: string }; errors?: unknown; message?: string };
    if (!res.ok || !data.id || !data.transaction?.url) {
      throw new Error(`Tap createPayment failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return { redirectUrl: data.transaction.url, providerRef: data.id };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const res = await fetch(`${BASE_URL}/charges/${providerRef}`, {
      headers: { Authorization: `Bearer ${secretKey()}` },
    });
    const data = (await res.json()) as { status?: string };
    if (!res.ok) throw new Error(`Tap verifyPayment failed: ${res.status} ${JSON.stringify(data)}`);
    const status = data.status || 'UNKNOWN';
    return { paid: status === 'CAPTURED', status, raw: data };
  }
}

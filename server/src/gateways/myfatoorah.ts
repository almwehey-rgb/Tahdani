import type { CreatePaymentParams, CreatePaymentResult, PaymentGateway, VerifyPaymentResult } from './types';

const BASE_URL = process.env.MYFATOORAH_BASE_URL || 'https://apitest.myfatoorah.com';

function apiKey(): string {
  const key = process.env.MYFATOORAH_API_KEY;
  if (!key) throw new Error('MYFATOORAH_API_KEY is not configured');
  return key;
}

export class MyFatoorahGateway implements PaymentGateway {
  name = 'myfatoorah';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const res = await fetch(`${BASE_URL}/api/v2/SendPayment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InvoiceValue: Number(params.amount.toFixed(3)),
        CustomerName: params.customerName || 'Customer',
        ...(params.customerEmail ? { CustomerEmail: params.customerEmail } : {}),
        ...(params.customerPhone ? { CustomerMobile: params.customerPhone.replace(/\D/g, '').slice(-8), MobileCountryCode: '+973' } : {}),
        NotificationOption: 'LNK',
        DisplayCurrencyIso: params.currency.toUpperCase(),
        CallBackUrl: params.callbackUrl,
        ErrorUrl: params.errorUrl,
        Language: 'ar',
        CustomerReference: params.purchaseId,
      }),
    });

    const data = (await res.json()) as {
      IsSuccess?: boolean;
      Message?: string;
      Data?: { InvoiceId?: number; InvoiceURL?: string };
    };
    if (!res.ok || !data.IsSuccess || !data.Data?.InvoiceURL) {
      throw new Error(`MyFatoorah createPayment failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return { redirectUrl: data.Data.InvoiceURL, providerRef: String(data.Data.InvoiceId) };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const res = await fetch(`${BASE_URL}/api/v2/GetPaymentStatus`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Key: providerRef, KeyType: 'InvoiceId' }),
    });
    const data = (await res.json()) as { IsSuccess?: boolean; Data?: { InvoiceStatus?: string } };
    if (!res.ok) throw new Error(`MyFatoorah verifyPayment failed: ${res.status} ${JSON.stringify(data)}`);
    const status = data.Data?.InvoiceStatus || 'Unknown';
    return { paid: status === 'Paid', status, raw: data };
  }
}

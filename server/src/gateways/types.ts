export interface CreatePaymentParams {
  purchaseId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  callbackUrl: string;
  errorUrl: string;
  webhookUrl?: string;
}

export interface CreatePaymentResult {
  redirectUrl: string;
  providerRef: string;
}

export interface VerifyPaymentResult {
  paid: boolean;
  status: string;
  raw: unknown;
}

export interface PaymentGateway {
  name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>;
}

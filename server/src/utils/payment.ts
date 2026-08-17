// Pluggable payment gateway. Swap `activeGateway` for a real GCC processor
// (MyFatoorah, Tap, Benefit Pay, KNET) once merchant credentials exist.
// The mock gateway always succeeds instantly so purchase flows are fully
// testable without a real merchant account.

export interface PaymentGateway {
  charge(amountFiat: number, currency: string): Promise<{ success: boolean; ref: string }>;
}

class MockPaymentGateway implements PaymentGateway {
  async charge(amountFiat: number, currency: string): Promise<{ success: boolean; ref: string }> {
    void amountFiat;
    void currency;
    const ref = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return { success: true, ref };
  }
}

export const activeGateway: PaymentGateway = new MockPaymentGateway();

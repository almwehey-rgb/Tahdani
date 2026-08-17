// Pluggable SMS provider. Swap `activeProvider` for a real gateway (Twilio, Ooredoo, etc.)
// once credentials are available. The console/dev provider logs the code server-side
// instead of sending a real SMS, which is what lets this whole app run without any
// telecom account.

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[SMS -> ${phone}] ${message}`);
  }
}

export const activeProvider: SmsProvider = new ConsoleSmsProvider();

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

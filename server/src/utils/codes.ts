import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nano = customAlphabet(alphabet, 8);

export function generateCode(prefix: string): string {
  return `${prefix}-${nano()}`;
}

// fără I, O, 0, 1 pentru claritate vizuală
const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_CHARS.charAt(Math.floor(Math.random() * REFERRAL_CHARS.length));
  }
  return code;
}

export function generateReferralUrl(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mate-bac-md.vercel.app';
  return `${baseUrl}/r/${code}`;
}

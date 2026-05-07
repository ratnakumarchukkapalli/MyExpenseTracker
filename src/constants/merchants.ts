export type MerchantInfo =
  | { type: 'svg'; icon: string; bg: string; brand: string }
  | { type: 'letter'; initials: string; bg: string; fg: string; brand: string };

type MerchantEntry = {
  keywords: string[];
  info: MerchantInfo;
};

const MERCHANT_MAP: MerchantEntry[] = [
  // ── SVG icons (Simple Icons, white on brand color) ──────────────────────
  { keywords: ['swiggy'], info: { type: 'svg', icon: '/merchant-icons/swiggy.svg', bg: '#FC8019', brand: 'Swiggy' } },
  { keywords: ['zomato'], info: { type: 'svg', icon: '/merchant-icons/zomato.svg', bg: '#E23744', brand: 'Zomato' } },
  { keywords: ['netflix'], info: { type: 'svg', icon: '/merchant-icons/netflix.svg', bg: '#E50914', brand: 'Netflix' } },
  { keywords: ['spotify'], info: { type: 'svg', icon: '/merchant-icons/spotify.svg', bg: '#1DB954', brand: 'Spotify' } },
  { keywords: ['youtube'], info: { type: 'svg', icon: '/merchant-icons/youtube.svg', bg: '#FF0000', brand: 'YouTube' } },
  { keywords: ['uber'], info: { type: 'svg', icon: '/merchant-icons/uber.svg', bg: '#000000', brand: 'Uber' } },
  { keywords: ['airtel'], info: { type: 'svg', icon: '/merchant-icons/airtel.svg', bg: '#E40000', brand: 'Airtel' } },
  { keywords: ['jio'], info: { type: 'svg', icon: '/merchant-icons/jio.svg', bg: '#0B2265', brand: 'Jio' } },
  { keywords: ['bigbasket'], info: { type: 'svg', icon: '/merchant-icons/bigbasket.svg', bg: '#84C225', brand: 'BigBasket' } },
  { keywords: ['bookmyshow', 'bms'], info: { type: 'svg', icon: '/merchant-icons/bookmyshow.svg', bg: '#E51937', brand: 'BookMyShow' } },
  { keywords: ['udemy'], info: { type: 'svg', icon: '/merchant-icons/udemy.svg', bg: '#A435F0', brand: 'Udemy' } },
  { keywords: ['coursera'], info: { type: 'svg', icon: '/merchant-icons/coursera.svg', bg: '#0056D2', brand: 'Coursera' } },
  { keywords: ['claude', 'anthropic'], info: { type: 'svg', icon: '/merchant-icons/anthropic.svg', bg: '#CC785C', brand: 'Anthropic' } },
  { keywords: ['paytm'], info: { type: 'svg', icon: '/merchant-icons/paytm.svg', bg: '#00BAF2', brand: 'Paytm' } },
  { keywords: ['phonepe'], info: { type: 'svg', icon: '/merchant-icons/phonepe.svg', bg: '#5F259F', brand: 'PhonePe' } },
  // Google: order matters — check specific products before bare "google"
  { keywords: ['google pay', 'googlepay', 'gpay'], info: { type: 'svg', icon: '/merchant-icons/googlepay.svg', bg: '#4285F4', brand: 'Google Pay' } },
  { keywords: ['google one', 'google pro', 'gemini', 'google'], info: { type: 'svg', icon: '/merchant-icons/google.svg', bg: '#4285F4', brand: 'Google' } },
  // Apple: check specific products before bare "apple"
  { keywords: ['apple fitness', 'apple one', 'apple pay', 'applepay', 'apple subscription', 'apple'], info: { type: 'svg', icon: '/merchant-icons/apple.svg', bg: '#555555', brand: 'Apple' } },

  // ── Letter avatars (Indian/regional brands not on Simple Icons) ──────────
  { keywords: ['amazon'], info: { type: 'letter', initials: 'A', bg: '#FF9900', fg: '#111', brand: 'Amazon' } },
  { keywords: ['microsoft', 'office365', 'office 365'], info: { type: 'letter', initials: 'MS', bg: '#0078D4', fg: '#fff', brand: 'Microsoft' } },
  { keywords: ['rapido'], info: { type: 'letter', initials: 'RA', bg: '#FFE000', fg: '#222', brand: 'Rapido' } },
  { keywords: ['hotstar', 'disney'], info: { type: 'letter', initials: 'HS', bg: '#1F80E0', fg: '#fff', brand: 'Hotstar' } },
  { keywords: ['lic'], info: { type: 'letter', initials: 'LIC', bg: '#00539C', fg: '#fff', brand: 'LIC' } },
  { keywords: ['tata play', 'tataplay', 'tatasky'], info: { type: 'letter', initials: 'TP', bg: '#681582', fg: '#fff', brand: 'Tata Play' } },
  { keywords: ['excel net', 'excel wifi', 'excel'], info: { type: 'letter', initials: 'EX', bg: '#0EA5E9', fg: '#fff', brand: 'Excel Net' } },
  { keywords: ['act net', 'act'], info: { type: 'letter', initials: 'A', bg: '#DC2626', fg: '#fff', brand: 'ACT' } },
  { keywords: ['apollo pharmacy', 'apollo'], info: { type: 'letter', initials: 'AP', bg: '#1A56DB', fg: '#fff', brand: 'Apollo' } },
  { keywords: ['urbancompany', 'urban company'], info: { type: 'letter', initials: 'UC', bg: '#7B2D8B', fg: '#fff', brand: 'UrbanCompany' } },
  { keywords: ['nykaa', 'nyka'], info: { type: 'letter', initials: 'NY', bg: '#FC2779', fg: '#fff', brand: 'Nykaa' } },
  { keywords: ['zee5'], info: { type: 'letter', initials: 'Z5', bg: '#8B5CF6', fg: '#fff', brand: 'ZEE5' } },
  { keywords: ['etv win'], info: { type: 'letter', initials: 'ETV', bg: '#E11D48', fg: '#fff', brand: 'ETV Win' } },
  { keywords: ['fancode'], info: { type: 'letter', initials: 'FC', bg: '#00B4D8', fg: '#fff', brand: 'FanCode' } },
  { keywords: ['cultfit', 'cult.fit'], info: { type: 'letter', initials: 'CF', bg: '#FF6B35', fg: '#fff', brand: 'Cult.fit' } },
  { keywords: ['licious'], info: { type: 'letter', initials: 'LC', bg: '#C0392B', fg: '#fff', brand: 'Licious' } },
  { keywords: ['chatgpt', 'openai'], info: { type: 'letter', initials: 'AI', bg: '#10A37F', fg: '#fff', brand: 'ChatGPT' } },
  { keywords: ['aws'], info: { type: 'letter', initials: 'AWS', bg: '#FF9900', fg: '#111', brand: 'AWS' } },
  { keywords: ['ratnadeep'], info: { type: 'letter', initials: 'RD', bg: '#16A34A', fg: '#fff', brand: 'Ratnadeep' } },
  { keywords: ['sids farm'], info: { type: 'letter', initials: 'SF', bg: '#65A30D', fg: '#fff', brand: "Sid's Farm" } },
];

export function getMerchantInfo(description: string): MerchantInfo | null {
  const lower = description.toLowerCase().trim();
  for (const entry of MERCHANT_MAP) {
    if (entry.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return entry.info;
    }
  }
  return null;
}

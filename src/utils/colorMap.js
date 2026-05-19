// ─────────────────────────────────────────────────────────────
// Color name → HEX mapping (EN / KR / CN)
// ─────────────────────────────────────────────────────────────

const COLOR_MAP = {
  // BLACK family
  BLACK: '#1A1A1A', BLK: '#1A1A1A', BLA: '#1A1A1A',
  '黑色': '#1A1A1A', '黑': '#1A1A1A', '검정': '#1A1A1A', '블랙': '#1A1A1A',

  // WHITE family
  WHITE: '#FAFAF7', WHT: '#FAFAF7',
  '白色': '#FAFAF7', '白': '#FAFAF7', '흰색': '#FAFAF7', '화이트': '#FAFAF7',
  'W/C': '#F5F5F0', WC: '#F5F5F0',

  // GRAY family
  GRAY: '#9CA3AF', GREY: '#9CA3AF', GRA: '#9CA3AF', GRY: '#9CA3AF',
  '灰色': '#9CA3AF', '灰': '#9CA3AF', '회색': '#9CA3AF', '그레이': '#9CA3AF',
  '花灰': '#B5B0A5',
  CHARCOAL: '#36454F', '炭灰': '#36454F', '차콜': '#36454F',
  HEATHER: '#B5B0A5',

  // NAVY family
  NAVY: '#1E3A5F', NVY: '#1E3A5F',
  '丈青色': '#1E3A5F', '丈青': '#1E3A5F', '深蓝': '#1E3A5F',
  '네이비': '#1E3A5F',

  // MOCHA / BROWN family
  'D/MOCHA': '#5C4A3A', 'D/MOCH': '#5C4A3A', 'D/M': '#5C4A3A', DM: '#5C4A3A',
  MOCHA: '#7C6651', MOCH: '#7C6651',
  '摩卡': '#7C6651', '深摩卡色': '#5C4A3A', '深摩卡': '#5C4A3A', '모카': '#7C6651',
  BROWN: '#7C5C3F', BRN: '#7C5C3F',
  '棕色': '#7C5C3F', '갈색': '#7C5C3F', '브라운': '#7C5C3F',
  KHAKI: '#A89968', '카키': '#A89968', '卡其': '#A89968',

  // BLUE family
  BLUE: '#3B82F6', BLU: '#3B82F6',
  '蓝色': '#3B82F6', '蓝': '#3B82F6', '파랑': '#3B82F6', '블루': '#3B82F6',
  INDIGO: '#2C3E80', IN: '#2C3E80', '靛蓝': '#2C3E80',
  '牛仔蓝': '#3B5998', DENIM: '#3B5998', '데님': '#3B5998',
  SKY: '#7DD3FC', '天蓝': '#7DD3FC', '하늘': '#7DD3FC', SKB: '#7DD3FC',
  ROYAL: '#1E40AF',

  // RED family
  RED: '#DC2626', '红色': '#DC2626', '红': '#DC2626', '빨강': '#DC2626', '레드': '#DC2626',
  WINE: '#722F37', '酒红': '#722F37', '와인': '#722F37',
  BURGUNDY: '#5C0E17',

  // PINK family
  PINK: '#F9A8D4', '粉色': '#F9A8D4', '핑크': '#F9A8D4',
  ROSE: '#FB7185', '玫红': '#FB7185',

  // YELLOW family
  YELLOW: '#FCD34D', YLW: '#FCD34D',
  '黄色': '#FCD34D', '黄': '#FCD34D', '노랑': '#FCD34D', '옐로우': '#FCD34D',
  GOLD: '#D4AF37', '金': '#D4AF37', '골드': '#D4AF37',
  MUSTARD: '#C9A845', '芥末': '#C9A845',

  // ORANGE family
  ORANGE: '#FB923C', ORG: '#FB923C',
  '橙色': '#FB923C', '주황': '#FB923C', '오렌지': '#FB923C',
  CORAL: '#FF7F50', '珊瑚': '#FF7F50',

  // GREEN family
  GREEN: '#22C55E', GRN: '#22C55E',
  '绿色': '#22C55E', '绿': '#22C55E', '초록': '#22C55E', '그린': '#22C55E',
  OLIVE: '#6B8E23', '橄榄': '#6B8E23', '올리브': '#6B8E23',
  MINT: '#6EE7B7', '薄荷': '#6EE7B7',
  FOREST: '#1F4E2A',

  // PURPLE family
  PURPLE: '#A855F7', PUR: '#A855F7',
  '紫色': '#A855F7', '보라': '#A855F7', '퍼플': '#A855F7',
  LAVENDER: '#C4B5FD', '薰衣草': '#C4B5FD',
  VIOLET: '#7C3AED',

  // BEIGE / CREAM family
  BEIGE: '#D4BFA0', BG: '#D4BFA0',
  '米色': '#D4BFA0', '베이지': '#D4BFA0',
  CREAM: '#F5E6C8', '奶白': '#F5E6C8', '크림': '#F5E6C8',
  IVORY: '#F0EAD6', '象牙': '#F0EAD6',
  TAN: '#D2B48C', SAND: '#E0CDA8',
}

export function getColorHex(colorName) {
  if (!colorName) return '#CCCCCC'

  const raw = String(colorName).trim()
  if (!raw) return '#CCCCCC'

  const upper = raw.toUpperCase()

  // 1. Exact (upper) match
  if (COLOR_MAP[upper]) return COLOR_MAP[upper]
  // 2. Exact (as-is — for CJK)
  if (COLOR_MAP[raw]) return COLOR_MAP[raw]

  // 3. Token match — split on space / dash / underscore / punctuation (NOT slash).
  // Keep "D/MOCHA" together so prefixes like D/ aren't lost.
  const tokens = raw.split(/[\s\-_·,()]+/).filter(Boolean)
  for (const tok of tokens) {
    const u = tok.toUpperCase()
    if (COLOR_MAP[u]) return COLOR_MAP[u]
    if (COLOR_MAP[tok]) return COLOR_MAP[tok]
  }

  // 4. Substring match — longest key wins
  const keys = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (k.length < 3) continue
    if (upper.includes(k.toUpperCase())) return COLOR_MAP[k]
    if (raw.includes(k)) return COLOR_MAP[k]
  }

  // 5. Fallback — neutral gray (NEVER random/hashed)
  return '#9CA3AF'
}

export function getTextColorOnBg(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return '#1A1A1A'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (r * 299 + g * 587 + b * 114) / 1000
  return lum > 140 ? '#1A1A1A' : '#FFFFFF'
}

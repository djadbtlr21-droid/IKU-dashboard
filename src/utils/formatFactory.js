// Strip Zoho's leading "_NN_" sorting prefix from factory names.
//   "_04_宁军（合祥）" → "宁军（合祥）"
//   "宁军（合祥）"      → "宁军（合祥）"  (unchanged)
//   ""/null/undefined → "-"
export function formatFactory(name) {
  if (!name) return '-'
  return String(name).replace(/^_\d+_/, '').trim() || '-'
}

const PINYIN_MAP = [
  ['宁军', 'NING JUN'],
  ['合祥', 'HE XIANG'],
  ['辉念', 'HUI NIAN'],
  ['盛达', 'SHENG DA'],
]

// Returns factory name with romanized pinyin appended, e.g.:
//   "宁军（合祥）" → "宁军（合祥）  NING JUN · HE XIANG"
//   "辉念"        → "辉念  HUI NIAN"
export function formatFactoryWithPinyin(name) {
  const base = formatFactory(name)
  const found = PINYIN_MAP.filter(([cn]) => base.includes(cn)).map(([, py]) => py)
  if (!found.length) return base
  return `${base}  ${found.join(' · ')}`
}

// Strip Zoho's leading "_NN_" sorting prefix from factory names.
//   "_04_宁军（合祥）" → "宁军（合祥）"
//   "宁军（合祥）"      → "宁军（合祥）"  (unchanged)
//   ""/null/undefined → "-"
export function formatFactory(name) {
  if (!name) return '-'
  return String(name).replace(/^_\d+_/, '').trim() || '-'
}

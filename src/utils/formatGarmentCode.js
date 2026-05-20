const TOP_TYPE_MAP = {
  B: 'Bra-top / 브라탑 / 运动内衣',
  C: 'Crop / 크롭 / 露脐装',
  T: 'Tank / 탱크 / 背心',
  R: 'Regular Top / 일반 상의 / 普通上衣',
}

const SLEEVE_MAP = {
  L: 'Long-sleeve / 긴팔 / 长袖',
  S: 'Short-sleeve / 반팔 / 短袖',
  N: 'None-sleeve / 민소매 / 无袖',
}

const FIT_MAP = {
  O: 'Oversize(Loose) / 루즈핏 / 宽松版',
  R: 'Regular-fit / 레귤러핏 / 标准版',
  S: 'Slim-fit / 슬림핏 / 修身版',
}

const DETAILS_MAP = {
  Z: 'Zip-up(Full) / 오픈짚업 / 全开拉链',
  H: 'Half-zip / 반짚업 / 半拉链',
  N: 'Neck(Round) / 라운드넥 / 圆领',
  C: 'Cami-strap / 끈나시 / 吊带',
  W: 'Wide-strap / 와이드스트랩 / 宽肩带',
  D: 'Hood / 후드 / 连帽',
  V: 'Vest / 베스트 / 马甲',
  J: 'Jacket / 재킷 / 外套',
  B: 'Windbreaker / 바람막이 / 防风衣',
}

const BOTTOM_TYPE_MAP = {
  L: 'Leggings / 레깅스 / 紧身裤',
  W: 'Wide / 와이드 / 宽腿裤',
  J: 'Jogger / 조거 / 束脚裤',
  F: 'Flare / 나팔 / 喇叭裤',
  P: 'Pleats / 플리츠 / 褶皱',
  A: 'A-line / A라인 / A字版',
  B: 'Shorts / 반바지 / 短裤',
}

const BOTTOM_LENGTH_MAP = {
  3: '3-Tier(Short) / 3부 / 三分',
  5: '5-Tier(Mid) / 5부 / 五分',
  7: '7-Tier(Mid-full) / 7부 / 七分',
  9: '9-Tier(Full) / 9부 / 九分',
}

const CATEGORY_MAP = {
  S: 'Set 套装',
  I: 'Individual 单件',
}

function lookup(map, code) {
  if (code == null || code === '' || code === '—') return '—'
  return map[String(code).trim().toUpperCase()] || String(code) || '—'
}

export function formatCategory(code) {
  if (code == null || code === '' || code === '—') return '—'
  return CATEGORY_MAP[String(code).trim().toUpperCase()] || String(code) || '—'
}
export function formatTopType(code) { return lookup(TOP_TYPE_MAP, code) }
export function formatSleeve(code) { return lookup(SLEEVE_MAP, code) }
export function formatFit(code) { return lookup(FIT_MAP, code) }
export function formatDetails(code) { return lookup(DETAILS_MAP, code) }
export function formatBottomType(code) { return lookup(BOTTOM_TYPE_MAP, code) }
export function formatBottomLength(code) { return lookup(BOTTOM_LENGTH_MAP, code) }

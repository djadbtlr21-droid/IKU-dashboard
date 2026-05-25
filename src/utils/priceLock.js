const STORAGE_KEY = 'iku_price_unlocked'
const CORRECT_PASSWORD = 'jera1111'

export function verifyPassword(input) {
  return input === CORRECT_PASSWORD
}

export function isPriceUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === 'true'
}

export function unlockPrice() {
  sessionStorage.setItem(STORAGE_KEY, 'true')
}

export function lockPrice() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function maskAmount(value, prefix = '¥') {
  if (value == null || value === '') return '-'
  return `${prefix}••••••`
}

export function maskUnit(value, prefix = '¥') {
  if (value == null || value === '') return '-'
  return `${prefix}••••`
}

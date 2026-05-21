import { isAdminRequest } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  res.setHeader('Cache-Control', 'no-store')
  let isAdmin = false
  try { isAdmin = isAdminRequest(req) } catch { isAdmin = false }
  return res.status(200).json({ isAdmin })
}

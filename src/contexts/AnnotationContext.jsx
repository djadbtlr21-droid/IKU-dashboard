import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'

const AnnotationContext = createContext(null)

async function safeFetchJson(url, init) {
  try {
    const res = await fetch(url, init)
    if (!res.ok) return { ok: false, status: res.status, data: null }
    const data = await res.json()
    return { ok: true, status: 200, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export function AnnotationProvider({ children }) {
  const [items, setItems] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const pendingRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      safeFetchJson('/api/annotations'),
      safeFetchJson('/api/admin-status')
    ]).then(([a, s]) => {
      if (cancelled) return
      if (a.ok && a.data && typeof a.data.items === 'object') setItems(a.data.items)
      if (s.ok && s.data) setIsAdmin(!!s.data.isAdmin)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (password) => {
    const r = await safeFetchJson('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (r.ok) { setIsAdmin(true); return true }
    return false
  }, [])

  const logout = useCallback(async () => {
    try { await fetch('/api/admin-logout', { method: 'POST' }) } catch { /* ignore */ }
    setIsAdmin(false)
  }, [])

  const requestAuth = useCallback((action) => {
    pendingRef.current = action
    setLoginOpen(true)
  }, [])

  const save = useCallback(async (key, text, color) => {
    const doSave = async () => {
      const r = await safeFetchJson(`/api/annotations?key=${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, color })
      })
      if (r.ok && r.data?.items) {
        setItems(r.data.items)
        return true
      }
      if (r.status === 401) {
        setIsAdmin(false)
        return null // signal "auth needed"
      }
      return false
    }
    const result = await doSave()
    if (result === null) {
      return new Promise(resolve => {
        requestAuth(async () => {
          const ok = await doSave()
          resolve(ok === true)
        })
      })
    }
    return result
  }, [requestAuth])

  const remove = useCallback(async (key) => {
    const doDelete = async () => {
      const r = await safeFetchJson(`/api/annotations?key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      })
      if (r.ok && r.data?.items) {
        setItems(r.data.items)
        return true
      }
      if (r.status === 401) {
        setIsAdmin(false)
        return null
      }
      return false
    }
    const result = await doDelete()
    if (result === null) {
      return new Promise(resolve => {
        requestAuth(async () => {
          const ok = await doDelete()
          resolve(ok === true)
        })
      })
    }
    return result
  }, [requestAuth])

  const onLoginSuccess = useCallback(() => {
    setLoginOpen(false)
    const action = pendingRef.current
    pendingRef.current = null
    if (action) action()
  }, [])

  const closeLogin = useCallback(() => {
    setLoginOpen(false)
    pendingRef.current = null
  }, [])

  const value = useMemo(() => ({
    items, isAdmin, ready,
    save, remove, login, logout,
    loginOpen, onLoginSuccess, closeLogin
  }), [items, isAdmin, ready, save, remove, login, logout, loginOpen, onLoginSuccess, closeLogin])

  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>
}

export function useAnnotations() {
  const ctx = useContext(AnnotationContext)
  if (!ctx) throw new Error('useAnnotations must be used within AnnotationProvider')
  return ctx
}

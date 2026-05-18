import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  {
    path: '/mo',
    label: 'MO View',
    sub: '생산진행 · 生产进度',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    active: true,
  },
  {
    path: null,
    label: 'Style View',
    sub: '스타일 · 款式',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    active: false,
    soon: true,
  },
  {
    path: null,
    label: 'Shipment',
    sub: '선적 · 装箱出货',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    active: false,
    soon: true,
  },
  {
    path: null,
    label: 'Factory',
    sub: '공장 · 工厂',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    active: false,
    soon: true,
  },
]

function formatTime(d) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Layout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lastSync, setLastSync] = useState(formatTime(new Date()))
  const [refreshing, setRefreshing] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  async function handleRefresh() {
    setRefreshing(true)
    // Trigger a page reload to re-fetch all data
    window.dispatchEvent(new Event('iku:refresh'))
    await new Promise((r) => setTimeout(r, 800))
    setLastSync(formatTime(new Date()))
    setRefreshing(false)
  }

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [window.location.pathname])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#1A1F2E' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40 flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          width: 240,
          background: '#252B3D',
          borderRight: '1px solid rgba(201,168,110,0.15)',
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid rgba(201,168,110,0.1)' }}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A86E 0%, #A8854A 100%)' }}>
            <span className="text-darkNavy font-bold text-sm" style={{ fontFamily: 'Inter' }}>IKU</span>
          </div>
          <div>
            <p className="text-cream font-bold text-sm leading-tight">IKU Dashboard</p>
            <p className="text-xs" style={{ color: '#8896B3' }}>JERA Production</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => (
            item.active && item.path ? (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                    isActive ? 'nav-active' : 'nav-idle'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'rgba(201,168,110,0.12)' : 'transparent',
                  color: isActive ? '#C9A86E' : '#8896B3',
                })}
              >
                {item.icon}
                <div>
                  <p className="text-sm font-semibold leading-tight">{item.label}</p>
                  <p className="text-xs opacity-75">{item.sub}</p>
                </div>
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
                style={{ color: '#8896B3' }}
              >
                {item.icon}
                <div>
                  <p className="text-sm font-semibold leading-tight flex items-center gap-2">
                    {item.label}
                    {item.soon && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(201,168,110,0.15)', color: '#C9A86E', fontSize: 9 }}>
                        SOON
                      </span>
                    )}
                  </p>
                  <p className="text-xs">{item.sub}</p>
                </div>
              </div>
            )
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 space-y-3"
          style={{ borderTop: '1px solid rgba(201,168,110,0.1)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#8896B3' }}>
              Last sync: {lastSync}
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#C9A86E' }}
              title="새로고침 · 刷新"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ color: '#8896B3' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8896B3' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃 · 退出
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 py-3 lg:hidden"
          style={{ background: '#252B3D', borderBottom: '1px solid rgba(201,168,110,0.1)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg"
            style={{ color: '#C9A86E' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-cream font-semibold text-sm">IKU Dashboard</span>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

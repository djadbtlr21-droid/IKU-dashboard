import { useState, createContext, useContext, useEffect } from "react"
import { Package, BarChart2, Truck, Sun, Moon, RefreshCw, Lock, LogOut } from "lucide-react"
import CoverPage from "./components/CoverPage"
import MoView from "./pages/MoView"
import OverviewPage from "./pages/OverviewPage"
import ShipmentPage from "./pages/ShipmentPage"
import ErrorBoundary from "./components/ErrorBoundary"
import { DataProvider } from "./contexts/DataContext"
import { AnnotationProvider } from "./contexts/AnnotationContext"
import AdminLoginGate from "./components/annotations/AdminLoginGate"
import AIPanel from "./components/ai/AIPanel"
import AIToggleButton from "./components/ai/AIToggleButton"
import { useAnnotations } from "./hooks/useAnnotation"

// ── THEME (Golden Hour) ──
const LT = {
  dk: false,
  bg: "#FAFAF7", surf: "#FFFFFF", card: "#FFFFFF", cardAlt: "#FBF9F4",
  border: "#EDE8DE", hair: "#E4DED2",
  primary: "#C9A86E", primarySoft: "#E8D5B0", accent: "#9A7228",
  tx: "#1A1714", mu: "#5A5248", fa: "#9A9080",
  ok: "#4A7058", bad: "#8A3E2E", warn: "#8A5A2E", cool: "#4E627A",
  nh: "rgba(26,23,20,0.035)", rh: "rgba(26,23,20,0.02)",
  cardShadow: "0 2px 8px rgba(26,23,20,0.06), 0 1px 2px rgba(26,23,20,0.04)",
  overlayBg: "rgba(26,23,20,0.45)",
}
const DK = {
  dk: true,
  bg: "#0F0E0C", surf: "#1A1916", card: "#221F1C", cardAlt: "#1A1916",
  border: "#2E2B27", hair: "#3A3630",
  primary: "#E8C898", primarySoft: "#C9A86E", accent: "#D4B080",
  tx: "#F5F0E8", mu: "#8A8278", fa: "#4A453E",
  ok: "#86B59A", bad: "#D28971", warn: "#D4A572", cool: "#9AAEC4",
  nh: "rgba(245,240,232,0.04)", rh: "rgba(245,240,232,0.025)",
  cardShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
  overlayBg: "rgba(0,0,0,0.6)",
}

const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)

const mkCSS = G => `
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%}
body{font-family:'Inter','Noto Sans KR',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:14.3px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${G.tx};background:${G.bg};overscroll-behavior-y:none}
button{font-family:inherit;touch-action:manipulation}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${G.border};border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:${G.fa}}

.nv{display:flex;align-items:center;gap:12px;padding:10px 22px;min-height:44px;font-size:13px;font-weight:500;color:${G.mu};cursor:pointer;transition:color .15s, background .15s;border-left:2px solid transparent;letter-spacing:-.05px}
.nv:hover{color:${G.tx};background:${G.nh}}
.nv.on{color:${G.accent};background:${G.dk ? "rgba(232,200,152,0.08)" : "rgba(201,168,110,0.08)"};border-left-color:${G.primary};font-weight:600}
.nv.disabled{cursor:not-allowed;opacity:.45}
.nv.disabled:hover{color:${G.mu};background:transparent}
.nv-label{white-space:nowrap;overflow:hidden;flex:1}
.nv-sub{font-size:10px;color:${G.fa};letterSpacing:".5px";margin-top:1px}

.chip{padding:7px 14px;font-size:11px;border-radius:999px;cursor:pointer;transition:all .15s;font-weight:500;letter-spacing:.1px;line-height:1.5;min-height:32px}
.chip:hover{border-color:${G.primary}}

.syne{font-family:'Outfit','Inter','Noto Sans KR',sans-serif;letter-spacing:-.3px}
.brand-syne{font-family:'Syne','Outfit',sans-serif;letter-spacing:-.5px}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.2px}

.rail{position:absolute;top:14px;left:14px;width:6px;height:6px;border-radius:50%;background:${G.primary};box-shadow:0 0 0 3px ${G.dk ? "rgba(232,200,152,0.15)" : "rgba(201,168,110,0.14)"}}
.card{background:${G.card};border:1px solid ${G.border};border-radius:12px;box-shadow:${G.cardShadow};position:relative}
.card-plain{background:${G.card};border:1px solid ${G.border};border-radius:12px}

.btn-primary{background:${G.tx};color:${G.bg};border:1px solid ${G.tx};border-radius:8px;padding:12px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s;letter-spacing:-.1px;min-height:44px}
.btn-primary:hover{opacity:.85}
.btn-ghost{background:transparent;color:${G.tx};border:1px solid ${G.border};border-radius:8px;padding:12px 18px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s;letter-spacing:-.1px;min-height:44px}
.btn-ghost:hover{background:${G.nh}}

.mobn{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;background:${G.surf};border-top:1px solid ${G.border};padding-bottom:env(safe-area-inset-bottom);min-height:64px}
.mb{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 0 8px;font-size:10px;color:${G.mu};cursor:pointer;flex:1;gap:4px;transition:color .15s;font-weight:500;position:relative;min-height:64px}
.mb.on{color:${G.accent}}
.mb.on::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:2px;background:${G.primary};border-radius:0 0 2px 2px}

/* Mobile fixed header */
.mhd{display:none;position:fixed;top:0;left:0;right:0;z-index:90;height:56px;background:${G.surf};border-bottom:1px solid ${G.border};padding:0 16px;padding-top:env(safe-area-inset-top);align-items:center;gap:10px}

/* AI FAB — above bottom tab bar */
.ai-fab{display:none;position:fixed;bottom:80px;right:16px;z-index:95;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,${G.primary} 0%,#A8854A 100%);color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(201,168,110,0.4);font-size:12px;font-weight:700;letter-spacing:.5px;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s;touch-action:manipulation}
.ai-fab:active{transform:scale(.94);box-shadow:0 2px 8px rgba(201,168,110,0.3)}
.ai-fab.fab-on{background:linear-gradient(135deg,#A8854A 0%,${G.primary} 100%)}

.page-wrap{padding:32px 48px 48px;width:100%}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

@media(max-width:860px){
  aside,.sb,.sidebar{display:none!important;width:0!important}
  main{width:100%!important;flex:1 1 100%!important;min-width:0!important}
  .mobn{display:flex!important}
  .mhd{display:flex!important}
  .ai-fab{display:flex!important}
  .page-wrap{padding:16px!important;padding-top:72px!important;padding-bottom:88px!important}
  /* Overview KPI 2-col grid */
  .mob-kpi{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  /* MO View KPI row: single-column stack (3-col → 1-col) */
  .kgr{grid-template-columns:1fr!important;gap:12px!important}
  /* MO cards: vertical 1-col instead of horizontal scroll */
  .schedule-scroll{flex-wrap:wrap!important;overflow-x:visible!important}
  .schedule-scroll>div{width:100%!important;flex-shrink:1!important;min-width:0!important}
  /* Pipeline: horizontal scroll kept */
  .pipeline-scroll{overflow-x:auto!important}
}
@media(max-width:480px){
  body{font-size:15.4px}
  .card{border-radius:10px}
  .mob-kpi{gap:8px!important}
}
`

const TABS = [
  { id: "overview", label: "Overview", sub: "대시보드 · 仪表盘", icon: BarChart2, active: true },
  { id: "mo", label: "MO View", sub: "생산진행 · 生产进度", icon: Package, active: true },
  { id: "shipment", label: "Shipment", sub: "출고현황 · 出货状况", icon: Truck, active: true },
]

function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

// Detects /admin/login URL and opens the modal automatically, then cleans the URL.
function AdminUrlHandler() {
  const { openLogin } = useAnnotations()
  useEffect(() => {
    if (window.location.pathname === '/admin/login') {
      window.history.replaceState({}, '', '/')
      openLogin()
    }
  }, [openLogin])
  return null
}

// Shows a lock/unlock icon in the sidebar footer to enter or exit admin mode.
function AdminSidebarButton({ G }) {
  const { isAdmin, openLogin, logout } = useAnnotations()
  if (isAdmin) {
    return (
      <button
        onClick={logout}
        aria-label="admin logout"
        title="Admin 로그아웃 · 退出管理"
        style={{
          background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8,
          cursor: "pointer", padding: "8px 10px", color: G.ok,
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 36, minHeight: 36, transition: "border-color .15s, color .15s"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = G.ok }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = G.border }}
      >
        <LogOut size={13} />
      </button>
    )
  }
  return (
    <button
      onClick={openLogin}
      aria-label="admin login"
      title="Admin 로그인 · 管理员登录"
      style={{
        background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8,
        cursor: "pointer", padding: "8px 10px", color: G.mu,
        display: "flex", alignItems: "center", justifyContent: "center",
        minWidth: 36, minHeight: 36, transition: "border-color .15s, color .15s"
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = G.primary; e.currentTarget.style.color = G.accent }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.mu }}
    >
      <Lock size={13} />
    </button>
  )
}

function ComingSoon({ G, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 14 }}>
      <div className="card" style={{ padding: "32px 40px", textAlign: "center" }}>
        <Rail G={G} />
        <p className="syne" style={{ fontSize: 20, fontWeight: 700, color: G.tx, marginBottom: 6 }}>{label}</p>
        <p style={{ fontSize: 12, color: G.mu, letterSpacing: "2px", textTransform: "uppercase" }}>Coming Soon</p>
        <p style={{ fontSize: 11, color: G.fa, marginTop: 6 }}>준비 중 · 即将推出</p>
      </div>
    </div>
  )
}

export default function App() {
  const [showCover, setShowCover] = useState(() => {
    try { return sessionStorage.getItem("iku_auth") !== "1" } catch { return true }
  })
  const [dark, setDark] = useState(false)
  const [tab, setTab] = useState("overview")
  const [refreshing, setRefreshing] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const G = dark ? DK : LT

  if (showCover) {
    return <CoverPage onEnter={() => setShowCover(false)} />
  }

  const activeTab = TABS.find(t => t.id === tab)

  const handleRefresh = async () => {
    setRefreshing(true)
    window.dispatchEvent(new Event("iku:refresh"))
    await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }

  return (
    <ThemeContext.Provider value={{ G, dark, setDark }}>
      <DataProvider>
      <AnnotationProvider>
      <AdminUrlHandler />
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: G.bg, color: G.tx, overflow: "hidden" }}>
        <style>{mkCSS(G)}</style>

        {/* ── Mobile fixed header (hidden on desktop via CSS) ── */}
        <div className="mhd">
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, flex: 1, minWidth: 0 }}>
            <span className="brand-syne" style={{ fontSize: 20, fontWeight: 700, color: G.primary, letterSpacing: "-.5px", lineHeight: 1 }}>IKU</span>
            <span style={{ fontSize: 8, color: G.mu, letterSpacing: "2px", textTransform: "uppercase", fontWeight: 600 }}>ERP</span>
          </div>
          <span className="syne" style={{ fontSize: 13, fontWeight: 700, color: G.tx, whiteSpace: "nowrap" }}>
            {activeTab?.label || "Dashboard"}
          </span>
          <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "flex-end" }}>
            <button
              onClick={handleRefresh} disabled={refreshing}
              style={{ background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8, cursor: refreshing ? "wait" : "pointer", padding: "8px 10px", color: G.mu, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 44, transition: "border-color .15s" }}
              onTouchStart={e => { e.currentTarget.style.borderColor = G.primary }}
              onTouchEnd={e => { e.currentTarget.style.borderColor = G.border }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            </button>
            <button
              onClick={() => setDark(!dark)}
              style={{ background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8, cursor: "pointer", padding: "8px 10px", color: G.mu, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 44, transition: "border-color .15s" }}
              onTouchStart={e => { e.currentTarget.style.borderColor = G.primary }}
              onTouchEnd={e => { e.currentTarget.style.borderColor = G.border }}
            >
              {dark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        {/* ── AI FAB for mobile (hidden on desktop via CSS) ── */}
        <button
          className={`ai-fab${aiOpen ? " fab-on" : ""}`}
          onClick={() => setAiOpen(o => !o)}
          title="AI 분석가 · AI 分析师"
        >
          AI
        </button>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <aside className="sb" style={{ width: 224, minWidth: 224, background: G.surf, borderRight: `1px solid ${G.border}`, display: "flex", flexDirection: "column", padding: "28px 0", transition: "background .2s" }}>
            <div style={{ padding: "0 24px 22px", borderBottom: `1px solid ${G.hair}`, marginBottom: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div className="brand-syne" style={{ fontSize: 34, fontWeight: 700, color: G.primary, lineHeight: .95, letterSpacing: "-.8px" }}>IKU</div>
                <div className="brand-syne" style={{ fontSize: 11, fontWeight: 400, color: G.accent, letterSpacing: "6px", marginTop: 6, textTransform: "uppercase" }}>ERP Dashboard</div>
                <div style={{ height: 1, background: `linear-gradient(90deg, transparent 0%, ${G.primary} 30%, ${G.primary} 70%, transparent 100%)`, marginTop: 12, marginBottom: 10 }} />
                <div style={{ fontSize: 9, color: G.mu, letterSpacing: "2.2px", textTransform: "uppercase", fontWeight: 600 }}>Operations · 2026</div>
              </div>
            </div>

            <nav style={{ flex: 1 }}>
              {TABS.map(t => (
                <div
                  key={t.id}
                  className={`nv${tab === t.id ? " on" : ""}${!t.active ? " disabled" : ""}`}
                  onClick={() => t.active && setTab(t.id)}
                  title={!t.active ? "Coming soon · 即将推出" : ""}
                >
                  <t.icon size={15} strokeWidth={1.8} />
                  <span className="nv-label">
                    {t.label}
                    {!t.active && <span style={{ marginLeft: 6, fontSize: 9, padding: "2px 6px", borderRadius: 999, background: G.dk ? "rgba(232,200,152,0.12)" : "rgba(201,168,110,0.12)", color: G.accent, letterSpacing: ".5px", fontWeight: 600 }}>SOON</span>}
                  </span>
                </div>
              ))}
            </nav>

            <div style={{ padding: "16px 24px", borderTop: `1px solid ${G.hair}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 10, color: G.mu, fontWeight: 600, letterSpacing: "1.5px" }}>IKU × JERA</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  aria-label="refresh"
                  title="새로고침 · 刷新"
                  style={{ background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8, cursor: refreshing ? "wait" : "pointer", padding: "8px 10px", color: G.mu, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 36, transition: "border-color .15s, color .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = G.primary; e.currentTarget.style.color = G.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.mu }}
                >
                  <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                </button>
                <button
                  onClick={() => setDark(!dark)}
                  aria-label="toggle theme"
                  style={{ background: "transparent", border: `1px solid ${G.border}`, borderRadius: 8, cursor: "pointer", padding: "8px 10px", color: G.mu, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 36, minHeight: 36, transition: "border-color .15s, color .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = G.primary; e.currentTarget.style.color = G.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.mu }}
                >
                  {dark ? <Sun size={13} /> : <Moon size={13} />}
                </button>
                <AIToggleButton onClick={() => setAiOpen(o => !o)} isOpen={aiOpen} G={G} tab={tab} />
                <AdminSidebarButton G={G} />
              </div>
            </div>
          </aside>

          <main style={{ flex: 1, overflow: "auto", background: G.bg, WebkitOverflowScrolling: "touch" }}>
            <div className="page-wrap">
              {tab === "overview" && (
                <ErrorBoundary>
                  <OverviewPage G={G} />
                </ErrorBoundary>
              )}
              {tab === "mo" && (
                <ErrorBoundary>
                  <MoView G={G} />
                </ErrorBoundary>
              )}
              {tab === "shipment" && (
                <ErrorBoundary>
                  <ShipmentPage G={G} />
                </ErrorBoundary>
              )}
              {tab !== "overview" && tab !== "mo" && tab !== "shipment" && activeTab && <ComingSoon G={G} label={activeTab.label} />}
            </div>
          </main>
        </div>

        <nav className="mobn" aria-label="mobile nav">
          {TABS.map(t => (
            <div
              key={t.id}
              className={`mb${tab === t.id ? " on" : ""}`}
              onClick={() => t.active && setTab(t.id)}
              style={{ opacity: t.active ? 1 : .4, cursor: t.active ? "pointer" : "not-allowed" }}
            >
              <t.icon size={18} strokeWidth={1.8} />
              <span>{t.label.split(" ")[0]}</span>
            </div>
          ))}
        </nav>
      </div>
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} G={G} />
      <AdminLoginGate G={G} />
      </AnnotationProvider>
      </DataProvider>
    </ThemeContext.Provider>
  )
}

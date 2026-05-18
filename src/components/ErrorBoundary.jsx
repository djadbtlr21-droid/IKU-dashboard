import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="rounded-2xl p-8 max-w-md w-full text-center"
            style={{ background: '#252B3D', border: '1px solid rgba(239,68,68,0.3)' }}>
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="#EF4444">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-base font-bold mb-2" style={{ color: '#F5F1E8' }}>
              데이터 표시 오류 · 数据显示错误
            </h2>
            <p className="text-sm mb-6" style={{ color: '#8896B3' }}>
              새로고침 후에도 문제가 지속되면 관리자에게 문의해 주세요.
              <br />
              <span style={{ fontSize: 11 }}>如持续出现问题，请联系管理员</span>
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A86E, #A8854A)', color: '#1A1F2E' }}
            >
              새로고침 · 刷新
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs cursor-pointer" style={{ color: '#3A4268' }}>오류 상세</summary>
                <pre className="text-xs mt-2 p-2 rounded overflow-auto" style={{ background: '#1A1F2E', color: '#EF4444', maxHeight: 120 }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

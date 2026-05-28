import { useEffect, useState } from 'react'
import type { AlgorithmName, ScanReport } from '../types'

const MOCK_REPORT: ScanReport = {
  totalMatches: 27,
  matchesByKeyword: {
    slot: 8,
    gacor: 7,
    maxwin: 5,
    togel: 4,
    bet: 3,
  },
  stats: [
    { algorithm: 'KMP', executionTimeMs: 1.23, matchCount: 12, comparisonCount: 4521 },
    { algorithm: 'BoyerMoore', executionTimeMs: 0.87, matchCount: 12, comparisonCount: 3102 },
    { algorithm: 'RegEx', executionTimeMs: 0.45, matchCount: 8, comparisonCount: 0 },
    { algorithm: 'Levenshtein', executionTimeMs: 3.12, matchCount: 7, comparisonCount: 0 },
  ],
  timestamp: Date.now(),
}

const ALGO_COLORS: Record<AlgorithmName, string> = {
  KMP: '#4f8ef7',
  BoyerMoore: '#f7914f',
  RegEx: '#4fc978',
  Levenshtein: '#c94f8e',
  AhoCorasick: '#f7e44f',
  RabinKarp: '#8e4fc9',
}

const ICONS = {
  detective: '/icons/detective.png',
  time: '/icons/time.png',
  checklist: '/icons/checklist.png',
  compareArrows: '/icons/compare_arrows.png',
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} us`
  return `${ms.toFixed(2)} ms`
}

export function PopupApp() {
  const [report, setReport] = useState<ScanReport | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    setReport(MOCK_REPORT)
  }, [])

  const handleRescan = () => {
    setIsScanning(true)
    setTimeout(() => {
      setReport({ ...MOCK_REPORT, timestamp: Date.now() })
      setIsScanning(false)
    }, 800)
  }

  const maxKeywordCount = report ? Math.max(...Object.values(report.matchesByKeyword)) : 1

  return (
    <div className="popup">
      <header className="popup-header">
        <div className="popup-logo">
          <img className="logo-icon" src={ICONS.detective} alt="Detective icon" />
          <div>
            <h1>Judol Detector</h1>
            <p>IF2211 Strategi Algoritma</p>
          </div>
        </div>
        <button
          className={`btn-rescan ${isScanning ? 'scanning' : ''}`}
          onClick={handleRescan}
          disabled={isScanning}
        >
          {isScanning ? 'Scanning...' : 'Rescan'}
        </button>
      </header>

      {report === null ? (
        <div className="empty-state">
          <p>Belum ada hasil scan.</p>
          <p>Tekan Rescan untuk mulai.</p>
        </div>
      ) : (
        <>
          <section className="section-total">
            <div className="total-badge">
              <span className="total-number">{report.totalMatches}</span>
              <span className="total-label">keyword terdeteksi</span>
            </div>
          </section>

          <section className="section-keywords">
            <h2>Perbandingan Keyword</h2>
            <div className="keyword-chart">
              {Object.entries(report.matchesByKeyword)
                .sort(([, a], [, b]) => b - a)
                .map(([keyword, count]) => (
                  <div key={keyword} className="chart-row">
                    <span className="chart-label">{keyword}</span>
                    <div className="chart-bar-wrap">
                      <div className="chart-bar" style={{ width: `${(count / maxKeywordCount) * 100}%` }} />
                    </div>
                    <span className="chart-count">{count}x</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="section-stats">
            <h2>Performa Algoritma</h2>
            <div className="algo-grid">
              {report.stats.map((stat) => (
                <div key={stat.algorithm} className="algo-card">
                  <div
                    className="algo-name"
                    style={{ borderLeft: `3px solid ${ALGO_COLORS[stat.algorithm]}` }}
                  >
                    {stat.algorithm}
                  </div>
                  <div className="algo-detail">
                    <span className="stat-line">
                      <img className="stat-icon" src={ICONS.time} alt="Execution time" />
                      {formatTime(stat.executionTimeMs)}
                    </span>
                    <span className="stat-line">
                      <img className="stat-icon" src={ICONS.checklist} alt="Match count" />
                      {stat.matchCount} match
                    </span>
                    {stat.comparisonCount > 0 && (
                      <span className="stat-line">
                        <img className="stat-icon" src={ICONS.compareArrows} alt="Comparison count" />
                        {stat.comparisonCount.toLocaleString()} cmp
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="popup-footer">
            Scan terakhir: {new Date(report.timestamp).toLocaleTimeString('id-ID')}
            <span className="mock-badge"> [MOCK DATA]</span>
          </footer>
        </>
      )}
    </div>
  )
}

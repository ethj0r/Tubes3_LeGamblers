import { useState, useEffect } from 'react'
import type { ScanReport, AlgorithmName } from '../types'

// Mock data palsu buat ngetes UI karena backend belum selesai
const MOCK_REPORT: ScanReport = {
  totalMatches: 27,
  matchesByKeyword: {
    'slot': 8,
    'gacor': 7,
    'maxwin': 5,
    'togel': 4,
    'bet': 3,
  },
  stats: [
    { algorithm: 'KMP', executionTimeMs: 1.23, matchCount: 12, comparisonCount: 4521 },
    { algorithm: 'BoyerMoore', executionTimeMs: 0.87, matchCount: 12, comparisonCount: 3102 },
    { algorithm: 'RegEx', executionTimeMs: 0.45, matchCount: 8, comparisonCount: 0 },
    { algorithm: 'Levenshtein', executionTimeMs: 3.12, matchCount: 7, comparisonCount: 0 },
  ],
  timestamp: Date.now(),
}

// Warna per algoritma biar gampang dibedain di chart
const ALGO_COLORS: Record<AlgorithmName, string> = {
  KMP: '#4f8ef7',
  BoyerMoore: '#f7914f',
  RegEx: '#4fc978',
  Levenshtein: '#c94f8e',
  AhoCorasick: '#f7e44f',
  RabinKarp: '#8e4fc9',
}

// Format waktu: kalau < 1ms tampilkan µs, kalau >= 1ms tampilkan ms
function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`
  return `${ms.toFixed(2)} ms`
}

export function PopupApp() {
  const [report, setReport] = useState<ScanReport | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    setReport(MOCK_REPORT)

    // TODO: uncomment waktu backend sudah kirim ScanReport 
    // Cara kerjanya: content script Orang B kirim pesan dengan tipe 'SCAN_REPORT',
    // popup dengerin di sini, terus update tampilan.
    //
    // const handleMessage = (message: { type: string; payload: ScanReport }) => {
    //   if (message.type === 'SCAN_REPORT') {
    //     setReport(message.payload)
    //     setIsScanning(false)
    //   }
    // }
    // chrome.runtime.onMessage.addListener(handleMessage)
    // return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // Tombol Rescan: kirim perintah ke content script buat scan ulang.
  // Backend akan dengerin pesan 'RESCAN' ini di content.ts-nya.
  const handleRescan = () => {
    setIsScanning(true)
    // Sementara mock: langsung set report lagi setelah delay singkat
    // Nanti dihapus kalau backend udah selesai
    setTimeout(() => {
      setReport({ ...MOCK_REPORT, timestamp: Date.now() })
      setIsScanning(false)
    }, 800)

    // TODO: nanti di-uncomment 
    // chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    //   if (tabs[0]?.id) {
    //     chrome.tabs.sendMessage(tabs[0].id, { type: 'RESCAN' })
    //   }
    // })
  }

  const maxKeywordCount = report
    ? Math.max(...Object.values(report.matchesByKeyword))
    : 1

  return (
    <div className="popup">
      {/* Header */}
      <header className="popup-header">
        <div className="popup-logo">
          <span className="logo-icon">🎰</span>
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
          {isScanning ? '⟳ Scanning...' : '⟳ Rescan'}
        </button>
      </header>

      {report === null ? (
        <div className="empty-state">
          <p>Belum ada hasil scan.</p>
          <p>Tekan Rescan untuk mulai.</p>
        </div>
      ) : (
        <>
          {/* Total Match */}
          <section className="section-total">
            <div className="total-badge">
              <span className="total-number">{report.totalMatches}</span>
              <span className="total-label">keyword terdeteksi</span>
            </div>
          </section>

          {/* Bar Chart Keyword:
              Chart manual pakai div, lebar bar = (count / max) * 100%
              Tidak pakai library supaya build tetap ringan.
          */}
          <section className="section-keywords">
            <h2>Perbandingan Keyword</h2>
            <div className="keyword-chart">
              {Object.entries(report.matchesByKeyword)
                .sort(([, a], [, b]) => b - a)
                .map(([keyword, count]) => (
                  <div key={keyword} className="chart-row">
                    <span className="chart-label">{keyword}</span>
                    <div className="chart-bar-wrap">
                      <div
                        className="chart-bar"
                        style={{ width: `${(count / maxKeywordCount) * 100}%` }}
                      />
                    </div>
                    <span className="chart-count">{count}×</span>
                  </div>
                ))}
            </div>
          </section>

          {/* Statistik Per Algoritma :
              Menampilkan waktu eksekusi, jumlah match, dan jumlah comparison
              untuk tiap algoritma (KMP, BM, RegEx, Levenshtein).
          */}
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
                    <span>⏱ {formatTime(stat.executionTimeMs)}</span>
                    <span>✓ {stat.matchCount} match</span>
                    {stat.comparisonCount > 0 && (
                      <span>↔ {stat.comparisonCount.toLocaleString()} cmp</span>
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
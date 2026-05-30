import { useCallback, useEffect, useState } from 'react'
import type { AlgorithmName, ScanReport } from '../types'

const PREFS_KEY = 'judolDetectorPrefs'
const REPORT_KEY = 'judolDetectorReport'

interface Prefs {
  censorMode: boolean
  enableOcr: boolean
  enableAhoCorasick: boolean
  enableRabinKarp: boolean
}

const DEFAULT_PREFS: Prefs = {
  censorMode: false,
  enableOcr: false,
  enableAhoCorasick: false,
  enableRabinKarp: false,
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

async function getActiveTabId(): Promise<number | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

async function sendToActiveTab<T>(message: unknown): Promise<T | null> {
  const tabId = await getActiveTabId()
  if (tabId == null) return null
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T
  } catch {
    return null
  }
}

async function readStoredReport(): Promise<ScanReport | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null
  const stored = await chrome.storage.local.get(REPORT_KEY)
  return (stored[REPORT_KEY] as ScanReport | undefined) ?? null
}

async function readPrefs(): Promise<Prefs> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return DEFAULT_PREFS
  const stored = await chrome.storage.local.get(PREFS_KEY)
  return { ...DEFAULT_PREFS, ...((stored[PREFS_KEY] as Partial<Prefs> | undefined) ?? {}) }
}

async function writePrefs(prefs: Prefs): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  await chrome.storage.local.set({ [PREFS_KEY]: prefs })
}

export function PopupApp() {
  const [report, setReport] = useState<ScanReport | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [statusNote, setStatusNote] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [storedPrefs, live] = await Promise.all([
        readPrefs(),
        sendToActiveTab<{ report: ScanReport | null; isScanning: boolean }>({ type: 'getReport' }),
      ])
      setPrefs(storedPrefs)
      if (live?.report) {
        setReport(live.report)
        setIsScanning(live.isScanning)
        return
      }
      const stored = await readStoredReport()
      if (stored) setReport(stored)
      else setStatusNote('Belum ada hasil scan untuk tab ini.')
    })()
  }, [])

  const triggerRescan = useCallback(async () => {
    setIsScanning(true)
    setStatusNote(null)
    const res = await sendToActiveTab<{ ok: boolean; report: ScanReport | null }>({ type: 'rescan' })
    setIsScanning(false)
    if (res?.report) {
      setReport(res.report)
    } else {
      setStatusNote('Tab ini tidak bisa di-scan (mungkin halaman internal Chrome).')
    }
  }, [])

  const updatePref = useCallback(
    async (patch: Partial<Prefs>) => {
      const next: Prefs = { ...prefs, ...patch }
      setPrefs(next)
      await writePrefs(next)
      void triggerRescan()
    },
    [prefs, triggerRescan],
  )

  const toggleCensor = useCallback(() => updatePref({ censorMode: !prefs.censorMode }), [prefs, updatePref])
  const toggleOcr = useCallback(() => updatePref({ enableOcr: !prefs.enableOcr }), [prefs, updatePref])
  const toggleAhoCorasick = useCallback(
    () => updatePref({ enableAhoCorasick: !prefs.enableAhoCorasick }),
    [prefs, updatePref],
  )
  const toggleRabinKarp = useCallback(
    () => updatePref({ enableRabinKarp: !prefs.enableRabinKarp }),
    [prefs, updatePref],
  )

  const maxKeywordCount = report ? Math.max(1, ...Object.values(report.matchesByKeyword)) : 1

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
          onClick={triggerRescan}
          disabled={isScanning}
        >
          {isScanning ? 'Scanning...' : 'Rescan'}
        </button>
      </header>

      <section className="section-prefs">
        <label className="pref-toggle">
          <input type="checkbox" checked={prefs.censorMode} onChange={toggleCensor} />
          <span>Blur konten judol</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={prefs.enableAhoCorasick} onChange={toggleAhoCorasick} />
          <span>Algoritma Aho-Corasick</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={prefs.enableRabinKarp} onChange={toggleRabinKarp} />
          <span>Algoritma Rabin-Karp</span>
        </label>
        <label className="pref-toggle">
          <input type="checkbox" checked={prefs.enableOcr} onChange={toggleOcr} />
          <span>OCR gambar (Tesseract)</span>
        </label>
      </section>

      {report === null ? (
        <div className="empty-state">
          <p>{statusNote ?? 'Memuat hasil scan...'}</p>
          {statusNote && <p>Tekan Rescan untuk mencoba lagi.</p>}
        </div>
      ) : (
        <>
          <section className="section-total">
            <div className="total-badge">
              <span className="total-number">{report.totalMatches}</span>
              <span className="total-label">keyword terdeteksi</span>
            </div>
          </section>

          {Object.keys(report.matchesByKeyword).length > 0 && (
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
          )}

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
          </footer>
        </>
      )}
    </div>
  )
}

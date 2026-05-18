'use client'

import { useState } from 'react'

// ── path generator (same logic as clover-marker.tsx, but with tunable params) ──

function cloverPath(N: number, k: number, hLobeScale: number, hValleyScale: number): string {
  const cx = 50, cy = 50, R_out = 46
  const R_in = R_out * (1 - k) / (1 + k)
  const hBase = (R_in + R_out) * Math.PI / (6 * N)
  const hLobe   = hBase * hLobeScale
  const hValley = hBase * hValleyScale

  const lobeAng  = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N
  const valleyAng = (i: number) => lobeAng(i) - Math.PI / N

  const pt  = (r: number, θ: number) => ({ x: cx + r * Math.cos(θ), y: cy + r * Math.sin(θ) })
  const tan = (θ: number) => ({ x: -Math.sin(θ), y: Math.cos(θ) })
  const f   = (n: number) => n.toFixed(3)

  const v0 = pt(R_in, valleyAng(0))
  let d = `M ${f(v0.x)},${f(v0.y)}`

  for (let i = 0; i < N; i++) {
    const vStart = pt(R_in, valleyAng(i))
    const lobe   = pt(R_out, lobeAng(i))
    const vEnd   = pt(R_in, valleyAng((i + 1) % N))

    const tvS = tan(valleyAng(i))
    const tL  = tan(lobeAng(i))
    const tvE = tan(valleyAng((i + 1) % N))

    const cp1 = { x: vStart.x + hValley * tvS.x, y: vStart.y + hValley * tvS.y }
    const cp2 = { x: lobe.x   - hLobe   * tL.x,  y: lobe.y   - hLobe   * tL.y  }
    d += ` C ${f(cp1.x)},${f(cp1.y)} ${f(cp2.x)},${f(cp2.y)} ${f(lobe.x)},${f(lobe.y)}`

    const cp3 = { x: lobe.x  + hLobe   * tL.x,   y: lobe.y  + hLobe   * tL.y  }
    const cp4 = { x: vEnd.x  - hValley * tvE.x,  y: vEnd.y  - hValley * tvE.y }
    d += ` C ${f(cp3.x)},${f(cp3.y)} ${f(cp4.x)},${f(cp4.y)} ${f(vEnd.x)},${f(vEnd.y)}`
  }
  return d + ' Z'
}

// Original 4-lobe brand shape, normalised into the same 100×100 viewBox
const ORIGINAL_PATH = (() => {
  const S = 1342.341
  const cx = S / 2, cy = S / 2
  const scale = 92 / S   // fit into 46-unit radius → 92-unit diameter, centred at 50
  const tx = 50 - cx * scale, ty = 50 - cy * scale
  // Raw coordinates from the original SVG
  const pts = [
    [342.313,1073.886],[334.78,1036.658],[305.683,1007.561],[268.455,1000.028],
    [115.362,968.893],[0,833.398],[0,671.17],
    [0,508.943],[115.362,373.447],[268.455,342.313],
    [305.683,334.78],[334.78,305.683],[342.313,268.455],
    [373.447,115.362],[508.943,0],[671.17,0],
    [833.398,0],[968.893,115.362],[1000.028,268.455],
    [1007.561,305.683],[1036.658,334.78],[1073.886,342.313],
    [1226.979,373.447],[1342.341,508.943],[1342.341,671.17],
    [1342.341,833.398],[1226.979,968.893],[1073.886,1000.028],
    [1036.658,1007.561],[1007.561,1036.658],[1000.028,1073.886],
    [968.893,1226.979],[833.398,1342.341],[671.17,1342.341],
    [508.943,1342.341],[373.447,1226.979],[342.313,1073.886],
  ]
  const s = ([x, y]: number[]) => `${(x * scale + tx).toFixed(3)},${(y * scale + ty).toFixed(3)}`
  return (
    `M ${s(pts[0])}` +
    ` C ${s(pts[1])} ${s(pts[2])} ${s(pts[3])}` +
    ` C ${s(pts[4])} ${s(pts[5])} ${s(pts[6])}` +
    ` C ${s(pts[7])} ${s(pts[8])} ${s(pts[9])}` +
    ` C ${s(pts[10])} ${s(pts[11])} ${s(pts[12])}` +
    ` C ${s(pts[13])} ${s(pts[14])} ${s(pts[15])}` +
    ` C ${s(pts[16])} ${s(pts[17])} ${s(pts[18])}` +
    ` C ${s(pts[19])} ${s(pts[20])} ${s(pts[21])}` +
    ` C ${s(pts[22])} ${s(pts[23])} ${s(pts[24])}` +
    ` C ${s(pts[25])} ${s(pts[26])} ${s(pts[27])}` +
    ` C ${s(pts[28])} ${s(pts[29])} ${s(pts[30])}` +
    ` C ${s(pts[31])} ${s(pts[32])} ${s(pts[33])}` +
    ` C ${s(pts[34])} ${s(pts[35])} ${s(pts[36])} Z`
  )
})()

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-sm font-mono">
        <span>{label}</span>
        <span className="text-green-700 font-bold">{value.toFixed(3)}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="accent-green-600"
      />
    </label>
  )
}

export default function CloverDebugPage() {
  const [k,           setK]           = useState(0.127)
  const [hLobeScale,  setHLobeScale]  = useState(1.0)
  const [hValleyScale, setHValleyScale] = useState(1.0)
  const [leaves,      setLeaves]      = useState(4)
  const [showOriginal, setShowOriginal] = useState(true)

  const path = cloverPath(leaves, k, hLobeScale, hValleyScale)

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex gap-10 items-start">

      {/* Controls */}
      <div className="w-72 shrink-0 flex flex-col gap-5 bg-surface rounded-xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Clover shape tuner</h1>

        <Slider label="k  (valley depth)" value={k} min={0} max={0.40} step={0.001} onChange={setK} />
        <Slider label="hLobe  (lobe handle)" value={hLobeScale} min={0.3} max={3.0} step={0.01} onChange={setHLobeScale} />
        <Slider label="hValley  (valley handle)" value={hValleyScale} min={0.3} max={3.0} step={0.01} onChange={setHValleyScale} />
        <Slider label="leaf count" value={leaves} min={2} max={12} step={1} onChange={v => setLeaves(Math.round(v))} />

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={showOriginal} onChange={e => setShowOriginal(e.target.checked)} />
          Show original (4-lobe)
        </label>

        <div className="text-xs font-mono bg-gray-50 rounded p-3 border border-gray-200 leading-relaxed">
          <p className="text-gray-500 mb-1">copy into clover-marker.tsx:</p>
          <p>const k = <span className="text-green-700">{k.toFixed(3)}</span></p>
          <p>hLobeScale = <span className="text-green-700">{hLobeScale.toFixed(2)}</span></p>
          <p>hValleyScale = <span className="text-green-700">{hValleyScale.toFixed(2)}</span></p>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-6 flex-wrap">
          {/* Large comparison */}
          <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-2 font-mono">large (400px)</p>
            <svg width="400" height="400" viewBox="0 0 100 100">
              {showOriginal && leaves === 4 && (
                <path d={ORIGINAL_PATH} fill="none" stroke="#d1fae5" strokeWidth="1.5" />
              )}
              <path d={path} fill="none" stroke="#16a34a" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Actual marker size */}
          <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
            <p className="text-xs text-gray-400 font-mono">actual marker size</p>
            <div className="flex gap-4 items-end">
              {[28, 56, 112].map(size => (
                <div key={size} className="flex flex-col items-center gap-1">
                  <svg
                    width={size} height={size} viewBox="0 0 100 100" overflow="visible"
                    style={{ filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))' }}
                  >
                    <path d={path} fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" />
                    <circle cx="50" cy="50" r="11" fill="white" />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
                      fill="#16a34a" fontFamily="system-ui" fontWeight="700" fontSize="14"
                      style={{ userSelect: 'none' }}>A</text>
                  </svg>
                  <span className="text-xs text-gray-400 font-mono">{size}px</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {showOriginal && leaves === 4 && (
          <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
            <span className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#d1fae5" strokeWidth="2"/></svg>
              original brand SVG
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#16a34a" strokeWidth="2"/></svg>
              current formula
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

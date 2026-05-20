function shapeParams(N: number) {
  const t = Math.max(0, Math.min(1, (N - 4) / (10 - 4)))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    k:             lerp(0.146, 0.116),
    hLobeScale:    1.95,
    hValleyScale:  lerp(0.42, 1.27),
  }
}

export function cloverPath(N: number): string {
  const cx = 50, cy = 50, R_out = 46
  const { k, hLobeScale, hValleyScale } = shapeParams(N)
  const R_in    = R_out * (1 - k) / (1 + k)
  const hBase   = (R_in + R_out) * Math.PI / (6 * N)
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

    const cp3 = { x: lobe.x  + hLobe   * tL.x,  y: lobe.y  + hLobe   * tL.y  }
    const cp4 = { x: vEnd.x  - hValley * tvE.x,  y: vEnd.y  - hValley * tvE.y }
    d += ` C ${f(cp3.x)},${f(cp3.y)} ${f(cp4.x)},${f(cp4.y)} ${f(vEnd.x)},${f(vEnd.y)}`
  }

  return d + ' Z'
}

import { motionOk, useCountUp } from '../lib/motion'
import { formatNumber } from '../lib/format'

/**
 * A figure that counts to its value like an instrument readout settling. Screen readers and tests get
 * the final figure only; the moving digits are hidden from them. With motion off it is plain text.
 */
export function CountUp({ value, play = true }: { value: number; play?: boolean }) {
  const shown = useCountUp(value, play)
  const final = formatNumber(value)
  if (!motionOk()) return <>{final}</>
  const decimals = (String(value).split('.')[1] ?? '').length
  return (
    <>
      <span aria-hidden="true">{formatNumber(Number(shown.toFixed(decimals)))}</span>
      <span className="visually-hidden">{final}</span>
    </>
  )
}

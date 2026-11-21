import type { HTMLAttributes } from 'react'

export default function SectionEyebrow({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className={[
        'font-sans text-[11px] font-normal uppercase tracking-[0.22em] text-white/70',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

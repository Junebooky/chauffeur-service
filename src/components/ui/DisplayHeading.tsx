import type { HTMLAttributes } from 'react'

type DisplayHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: 'h2' | 'h3'
}

/**
 * Shared ultra-light display typography from "Your journey. Your way."
 */
export default function DisplayHeading({
  as = 'h2',
  className = '',
  children,
  ...props
}: DisplayHeadingProps) {
  const classes = ['chauffeur-display-heading', className].filter(Boolean).join(' ')

  if (as === 'h3') {
    return (
      <h3 {...props} className={classes}>
        {children}
      </h3>
    )
  }

  return (
    <h2 {...props} className={classes}>
      {children}
    </h2>
  )
}

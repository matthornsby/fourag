interface XCloseIconProps {
  size?: number
  stroke?: string
  strokeWidth?: number
  fill?: string
  className?: string
  onClick?: () => void
  "aria-label"?: string
}

export function XCloseIcon({
  size = 24,
  stroke = "currentColor",
  strokeWidth = 2.08,
  fill = "none",
  className,
  onClick,
  "aria-label": ariaLabel,
}: XCloseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23 23"
      onClick={onClick}
      aria-label={ariaLabel}
      role={onClick ? "button" : undefined}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fillRule: "evenodd", clipRule: "evenodd", strokeLinejoin: "round", strokeMiterlimit: 2 }}
      className={className}
    >
      <path
        d="M11.953,20.073C11.401,19.706 10.682,19.706 10.13,20.073C7.856,21.578 4.759,21.329 2.756,19.327C0.754,17.324 0.505,14.228 2.011,11.953C2.377,11.401 2.377,10.682 2.011,10.13C0.505,7.856 0.754,4.759 2.756,2.756C4.759,0.754 7.856,0.505 10.13,2.011C10.682,2.377 11.401,2.377 11.953,2.011C14.228,0.505 17.324,0.754 19.327,2.756C21.33,4.759 21.578,7.856 20.073,10.13C19.706,10.682 19.706,11.401 20.073,11.953C21.578,14.228 21.33,17.324 19.327,19.327C17.324,21.329 14.228,21.578 11.953,20.073Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <path
        d="M6.404,6.404L15.679,15.679"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
      <path
        d="M15.679,6.404L6.404,15.679"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
    </svg>
  )
}

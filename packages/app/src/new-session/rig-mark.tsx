// The fork's "RIG" in the wordmark's pixel style, with its trailing cursor. It sits under the pinboard wordmark, not in it:
// the pinboard's letter geometry is fixed to the 234×42 logo.
export function RigMark(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 272 80"
      preserveAspectRatio="xMaxYMid meet"
      fill="currentColor"
      opacity="0.7"
      shape-rendering="crispEdges"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <rect x="0" y="0" width="16" height="16" />
      <rect x="16" y="0" width="16" height="16" />
      <rect x="32" y="0" width="16" height="16" />
      <rect x="48" y="0" width="16" height="16" />
      <rect x="0" y="16" width="16" height="16" />
      <rect x="48" y="16" width="16" height="16" />
      <rect x="0" y="32" width="16" height="16" />
      <rect x="16" y="32" width="16" height="16" />
      <rect x="32" y="32" width="16" height="16" />
      <rect x="48" y="32" width="16" height="16" />
      <rect x="0" y="48" width="16" height="16" />
      <rect x="32" y="48" width="16" height="16" />
      <rect x="0" y="64" width="16" height="16" />
      <rect x="48" y="64" width="16" height="16" />
      <rect x="80" y="0" width="16" height="16" />
      <rect x="96" y="0" width="16" height="16" />
      <rect x="112" y="0" width="16" height="16" />
      <rect x="96" y="16" width="16" height="16" />
      <rect x="96" y="32" width="16" height="16" />
      <rect x="96" y="48" width="16" height="16" />
      <rect x="80" y="64" width="16" height="16" />
      <rect x="96" y="64" width="16" height="16" />
      <rect x="112" y="64" width="16" height="16" />
      <rect x="144" y="0" width="16" height="16" />
      <rect x="160" y="0" width="16" height="16" />
      <rect x="176" y="0" width="16" height="16" />
      <rect x="192" y="0" width="16" height="16" />
      <rect x="144" y="16" width="16" height="16" />
      <rect x="144" y="32" width="16" height="16" />
      <rect x="176" y="32" width="16" height="16" />
      <rect x="192" y="32" width="16" height="16" />
      <rect x="144" y="48" width="16" height="16" />
      <rect x="192" y="48" width="16" height="16" />
      <rect x="144" y="64" width="16" height="16" />
      <rect x="160" y="64" width="16" height="16" />
      <rect x="176" y="64" width="16" height="16" />
      <rect x="192" y="64" width="16" height="16" />
      <rect x="224" y="64" width="16" height="16" />
      <rect x="240" y="64" width="16" height="16" />
      <rect x="256" y="64" width="16" height="16" />
    </svg>
  )
}

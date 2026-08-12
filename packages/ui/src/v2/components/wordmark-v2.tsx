import { createUniqueId, type ComponentProps } from "solid-js"

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1240 129"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.6">
        <g mask={`url(#${mask})`}>
          <g opacity="0.16">
            <path
              opacity="0.7"
              d="M55.3846 36.4286H18.4615V91.7143H55.3846V36.4286ZM73.8462 110.143H0V18H73.8462V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M110.462 91.7143H147.385V36.4286H110.462V91.7143ZM165.846 110.143H110.462V128.571H92V18H165.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M258.846 73.2857H203.462V91.7143H258.846V110.143H185V18H258.846V73.2857ZM203.462 54.8571H240.385V36.4286H203.462V54.8571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M332.385 36.4286H295.462V110.143H277V18H332.385V36.4286ZM350.846 110.143H332.385V36.4286H350.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M442.846 36.4286H387.462V91.7143H442.846V110.143H369V18H442.846V36.4286Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M517.385 36.4286H480.462V91.7143H517.385V36.4286ZM535.846 110.143H462V18H535.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M609.385 36.8571H572.462V92.1429H609.385V36.8571ZM627.846 110.571H554V18.4286H609.385V0H627.846V110.571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M664.462 36.4286V54.8571H701.385V36.4286H664.462ZM719.846 73.2857H664.462V91.7143H719.846V110.143H646V18H719.846V73.2857Z"
              fill="currentColor"
            />

            <g transform="translate(270, 0)" fill="currentColor" opacity="0.7" shape-rendering="crispEdges">
              <rect x="528" y="0" width="16" height="16" />
              <rect x="480" y="16" width="16" height="16" />
              <rect x="496" y="16" width="16" height="16" />
              <rect x="512" y="16" width="16" height="16" />
              <rect x="528" y="16" width="16" height="16" />
              <rect x="480" y="32" width="16" height="16" />
              <rect x="528" y="32" width="16" height="16" />
              <rect x="480" y="48" width="16" height="16" />
              <rect x="528" y="48" width="16" height="16" />
              <rect x="480" y="64" width="16" height="16" />
              <rect x="528" y="64" width="16" height="16" />
              <rect x="480" y="80" width="16" height="16" />
              <rect x="496" y="80" width="16" height="16" />
              <rect x="512" y="80" width="16" height="16" />
              <rect x="528" y="80" width="16" height="16" />
              <rect x="496" y="48" width="16" height="16" />
              <rect x="512" y="48" width="16" height="16" />
              <rect x="496" y="64" width="16" height="16" />
              <rect x="512" y="64" width="16" height="16" />
              <rect x="560" y="16" width="16" height="16" />
              <rect x="576" y="16" width="16" height="16" />
              <rect x="592" y="16" width="16" height="16" />
              <rect x="608" y="16" width="16" height="16" />
              <rect x="560" y="32" width="16" height="16" />
              <rect x="608" y="32" width="16" height="16" />
              <rect x="560" y="48" width="16" height="16" />
              <rect x="576" y="48" width="16" height="16" />
              <rect x="592" y="48" width="16" height="16" />
              <rect x="608" y="48" width="16" height="16" />
              <rect x="560" y="64" width="16" height="16" />
              <rect x="560" y="80" width="16" height="16" />
              <rect x="576" y="80" width="16" height="16" />
              <rect x="592" y="80" width="16" height="16" />
              <rect x="608" y="80" width="16" height="16" />
              <rect x="576" y="64" width="16" height="16" />
              <rect x="592" y="64" width="16" height="16" />
              <rect x="608" y="64" width="16" height="16" />
              <rect x="672" y="16" width="16" height="16" />
              <rect x="688" y="16" width="16" height="16" />
              <rect x="704" y="16" width="16" height="16" />
              <rect x="720" y="16" width="16" height="16" />
              <rect x="672" y="32" width="16" height="16" />
              <rect x="720" y="32" width="16" height="16" />
              <rect x="672" y="48" width="16" height="16" />
              <rect x="688" y="48" width="16" height="16" />
              <rect x="704" y="48" width="16" height="16" />
              <rect x="720" y="48" width="16" height="16" />
              <rect x="672" y="64" width="16" height="16" />
              <rect x="704" y="64" width="16" height="16" />
              <rect x="672" y="80" width="16" height="16" />
              <rect x="720" y="80" width="16" height="16" />
              <rect x="752" y="16" width="16" height="16" />
              <rect x="768" y="16" width="16" height="16" />
              <rect x="784" y="16" width="16" height="16" />
              <rect x="768" y="32" width="16" height="16" />
              <rect x="768" y="48" width="16" height="16" />
              <rect x="768" y="64" width="16" height="16" />
              <rect x="752" y="80" width="16" height="16" />
              <rect x="768" y="80" width="16" height="16" />
              <rect x="784" y="80" width="16" height="16" />
              <rect x="816" y="16" width="16" height="16" />
              <rect x="832" y="16" width="16" height="16" />
              <rect x="848" y="16" width="16" height="16" />
              <rect x="864" y="16" width="16" height="16" />
              <rect x="816" y="32" width="16" height="16" />
              <rect x="816" y="48" width="16" height="16" />
              <rect x="848" y="48" width="16" height="16" />
              <rect x="864" y="48" width="16" height="16" />
              <rect x="816" y="64" width="16" height="16" />
              <rect x="864" y="64" width="16" height="16" />
              <rect x="816" y="80" width="16" height="16" />
              <rect x="832" y="80" width="16" height="16" />
              <rect x="848" y="80" width="16" height="16" />
              <rect x="864" y="80" width="16" height="16" />
              <rect x="912" y="80" width="16" height="16" />
              <rect x="928" y="80" width="16" height="16" />
              <rect x="944" y="80" width="16" height="16" />
            </g>
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="1240" height="129">
          <rect width="1240" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="620" y1="68" x2="620" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

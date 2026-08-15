import { he } from "../../i18n/he";

const nodes = [
  { id: "hq", x: 28, y: 28, label: he.authOpsNetworkNodes[0].label, delay: "0s" },
  { id: "s04", x: 132, y: 28, label: he.authOpsNetworkNodes[1].label, delay: "0.35s" },
  { id: "s17", x: 236, y: 28, label: he.authOpsNetworkNodes[2].label, delay: "0.7s" },
  { id: "s21", x: 132, y: 86, label: he.authOpsNetworkNodes[3].label, delay: "0.5s" },
  { id: "s32", x: 236, y: 86, label: he.authOpsNetworkNodes[4].label, delay: "0.9s" },
] as const;

const links: Array<[number, number, number, number]> = [
  [28, 28, 132, 28],
  [132, 28, 236, 28],
  [132, 28, 132, 86],
  [132, 86, 236, 86],
];

export function AuthNetwork() {
  return (
    <svg
      viewBox="0 0 264 112"
      className="h-auto w-full"
      role="img"
      aria-label={he.authOpsNetworkLabel}
    >
      <title>{he.authOpsNetworkLabel}</title>
      {links.map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1}-${y1}-${x2}-${y2}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className="auth-flow"
          stroke="rgb(11 107 203 / 55%)"
          strokeWidth="1"
        />
      ))}
      {nodes.map((node) => (
        <g key={node.id}>
          <circle cx={node.x} cy={node.y} r="10" fill="rgb(11 107 203 / 10%)" />
          <circle
            cx={node.x}
            cy={node.y}
            r="3.25"
            className="auth-node-pulse"
            style={{ animationDelay: node.delay }}
            fill="#4d9adc"
          />
          <text
            x={node.x}
            y={node.y - 14}
            textAnchor="middle"
            fill="#8b9bb0"
            fontFamily="var(--font-mono)"
            fontSize="8"
            letterSpacing="0.12em"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

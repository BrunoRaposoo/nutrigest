interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}

export function BarChart({
  data,
  height = 200,
  color = '#c9a84c',
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 600;
  const barWidth = Math.max(12, Math.min(40, width / data.length - 8));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Gráfico de barras"
    >
      {data.map((d, i) => {
        const barHeight = (d.value / max) * (height - 40);
        const x =
          (width / data.length) * i + (width / data.length - barWidth) / 2;
        const y = height - 24 - barHeight;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx={4}
              className="transition-all duration-500"
            />
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[10px]"
            >
              {d.label}
            </text>
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              className="fill-gray-700 dark:fill-gray-200 text-[10px] font-medium"
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

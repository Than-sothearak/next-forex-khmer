export default function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, string> = {
    calendar:
      "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm2 10h2m4 0h2m-8 3h2",
    clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    refresh:
      "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1",
    arrow: "m9 5 7 7-7 7",
    globe:
      "M2 12h20M12 2a17 17 0 0 1 0 20 17 17 0 0 1 0-20Zm10 10a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    book: "M12 5v16M3 3l9 2 9-2v16l-9 2-9-2V3Zm3 5 3 1m6 0 3-1",
    info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    chart: "M4 20V4m0 16h17M8 15l4-5 4 2 5-7",
    filter: "M4 6h16M7 12h10m-7 6h4",
    check: "m5 12 4 4L19 6",
    menu: "M4 6h16M4 12h16M4 18h16",
  };

  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}

type SummaryLineProps = {
  label: string;
  value: string;
  mono?: boolean;
};

export function SummaryLine({ label, value, mono }: SummaryLineProps) {
  const valueClass = mono ? 'font-mono text-xs' : '';
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}


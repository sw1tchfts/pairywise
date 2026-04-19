'use client';

import type { Algorithm } from '@/lib/types';

type Props = {
  value: Algorithm;
  onChange: (algo: Algorithm) => void;
};

export function AlgorithmToggle({ value, onChange }: Props) {
  const options: { key: Algorithm; label: string; hint: string }[] = [
    { key: 'elo', label: 'Fast', hint: 'ELO · live updates, forgiving on partial data' },
    { key: 'bradleyTerry', label: 'Rigorous', hint: 'Bradley-Terry · recomputes strengths from every vote' },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 p-0.5 bg-foreground/5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          title={o.hint}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition ${
            value === o.key
              ? 'bg-background shadow-sm'
              : 'text-foreground/70 hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

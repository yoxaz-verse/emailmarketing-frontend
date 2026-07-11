import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<string, string> = {
  executive: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  practical: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warm: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  bold: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  analytical: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
};

function toLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function TemplateToneBadge({
  tone,
  className,
}: {
  tone: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('text-[10px]', TONE_STYLES[tone] ?? 'border-border/60', className)}>
      {toLabel(tone)}
    </Badge>
  );
}

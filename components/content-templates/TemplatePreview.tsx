import { cn } from '@/lib/utils';

export function TemplatePreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.split('\n').filter(Boolean).slice(0, 4);

  return (
    <div className={cn('rounded-md border border-border/60 bg-background/70 p-3 text-xs leading-relaxed text-muted-foreground', className)}>
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className={index > 0 ? 'mt-2' : undefined}>
          {line}
        </p>
      ))}
    </div>
  );
}

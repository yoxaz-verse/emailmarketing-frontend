import { Check, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TemplatePreview } from './TemplatePreview';
import { TemplateToneBadge } from './TemplateToneBadge';

type TemplateCardItem = {
  id: string;
  name: string;
  category: string;
  tone: string;
  platforms: string[];
  content: string;
  hashtags: string[];
};

function labelize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function TemplateCard({
  template,
  selected,
  onUse,
  className,
}: {
  template: TemplateCardItem;
  selected?: boolean;
  onUse: (template: TemplateCardItem) => void;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'flex min-h-[280px] flex-col rounded-lg border border-border/60 bg-muted/30 p-3 transition hover:border-blue-400/60 hover:bg-muted/50 dark:bg-white/[0.03]',
        selected ? 'border-blue-500/70 bg-blue-500/10 shadow-sm shadow-blue-500/10' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/80">
              <LayoutTemplate className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </span>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold">{template.name}</h4>
              <p className="text-[11px] text-muted-foreground">{labelize(template.category)}</p>
            </div>
          </div>
        </div>
        {selected ? <Check className="h-4 w-4 text-blue-600 dark:text-blue-300" /> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <TemplateToneBadge tone={template.tone} />
        {template.platforms.slice(0, 3).map((platform) => (
          <Badge key={platform} variant="outline" className="text-[10px]">
            {labelize(platform)}
          </Badge>
        ))}
      </div>

      <TemplatePreview content={template.content} className="flex-1" />

      <div className="mt-3 flex flex-wrap gap-1">
        {template.hashtags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <Button className="mt-3 w-full" size="sm" variant={selected ? 'secondary' : 'default'} onClick={() => onUse(template)}>
        {selected ? 'Selected' : 'Use Template'}
      </Button>
    </article>
  );
}

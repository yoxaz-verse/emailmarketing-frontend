import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TemplateCard } from './TemplateCard';

type PickerTemplate = {
  id: string;
  name: string;
  category: string;
  tone: string;
  platforms: string[];
  content: string;
  hashtags: string[];
};

type CategoryOption = {
  value: string;
  label: string;
};

export function TemplatePicker<T extends PickerTemplate>({
  templates,
  categories,
  selectedTemplateId,
  activeCategory,
  search,
  onCategoryChange,
  onSearchChange,
  onUseTemplate,
  className,
}: {
  templates: T[];
  categories: CategoryOption[];
  selectedTemplateId?: string | null;
  activeCategory: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (value: string) => void;
  onUseTemplate: (template: T) => void;
  className?: string;
}) {
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((template) => {
      const categoryMatch = activeCategory === 'all' || template.category === activeCategory;
      const searchMatch = !needle || [
        template.name,
        template.category,
        template.tone,
        template.content,
        template.hashtags.join(' '),
      ].join(' ').toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, search, templates]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
            placeholder="Search templates"
          />
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={cn(
              'h-9 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition',
              activeCategory === 'all' ? 'border-blue-500 bg-blue-600 text-white' : 'border-border/60 bg-background hover:bg-muted'
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => onCategoryChange(category.value)}
              className={cn(
                'h-9 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition',
                activeCategory === category.value ? 'border-blue-500 bg-blue-600 text-white' : 'border-border/60 bg-background hover:bg-muted'
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
          No templates match the current filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selectedTemplateId === template.id}
              onUse={(item) => onUseTemplate(item as T)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

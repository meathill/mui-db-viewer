import { AlertTriangleIcon, InfoIcon, SparklesIcon } from 'lucide-react';
import type { StructureEditorInsight, StructureInsightTone } from './structure-editor-insights';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const toneStyles: Record<
  StructureInsightTone,
  { icon: typeof InfoIcon; className: string; badgeVariant: 'info' | 'success' | 'warning' }
> = {
  info: {
    icon: InfoIcon,
    className: 'border-info/30 bg-info/6',
    badgeVariant: 'info',
  },
  success: {
    icon: SparklesIcon,
    className: 'border-success/30 bg-success/6',
    badgeVariant: 'success',
  },
  warning: {
    icon: AlertTriangleIcon,
    className: 'border-warning/30 bg-warning/8',
    badgeVariant: 'warning',
  },
};

interface StructureEditorFeedbackProps {
  insight: StructureEditorInsight;
}

export function StructureEditorFeedback({ insight }: StructureEditorFeedbackProps) {
  const tone = toneStyles[insight.tone];
  const Icon = tone.icon;

  return (
    <section className={cn('space-y-3 rounded-2xl border p-4', tone.className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-background/80">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm">{insight.title}</h3>
            <Badge variant={tone.badgeVariant}>{insight.hasChanges ? '有变更' : '无变更'}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{insight.description}</p>
        </div>
      </div>

      {insight.changes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insight.changes.map((item) => (
            <Badge
              key={item}
              variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

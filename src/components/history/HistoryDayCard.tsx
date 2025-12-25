import type { ReactNode } from "react";
import { Block } from "konsta/react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function HistoryDayCard(props: {
  title: string;
  summary?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { title, summary, isExpanded, onToggle, actions, children } = props;

  return (
    <Block strong inset className="space-y-3">
      <div className="flex items-start justify-between gap-3">

        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between text-left gap-3"
        >
          <div className="space-y-1">
            <div className="text-base font-semibold">{title}</div>
            {summary ? <div className="text-xs opacity-70">{summary}</div> : null}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 opacity-70" />
          ) : (
            <ChevronDown className="w-5 h-5 opacity-70" />
          )}
        </button>
      </div>
      {isExpanded ? <div className="space-y-3">
        {actions ? <div className="pt-1">{actions}</div> : null}
        {children}
      </div> : null}
    </Block>
  );
}

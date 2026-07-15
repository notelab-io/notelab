import {
  ArrowUpRightIcon,
  Database,
  MoreHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";

import { DropDrawerItem } from "@/components/ui/dropdrawer";

import type { DatabaseLinkedViewConfig } from "../database-view-config";
import type { DatabaseSourceMenuItem } from "./types";
import { getDatabaseViewTypePresentation } from "./view-type-options";

export function DataSourceSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

export function DataSourceAddGlyph() {
  return (
    <span className="inline-flex size-4 items-center justify-center text-base leading-none text-muted-foreground">
      +
    </span>
  );
}

export function DataSourceMenuItem({ item }: { item: DatabaseSourceMenuItem }) {
  const viewLabel = `${item.viewCount} view${item.viewCount === 1 ? "" : "s"}`;

  return (
    <DropDrawerItem disabled>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Database className="text-muted-foreground" />
        <span className="truncate">{item.name}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">
          {viewLabel}
        </span>
        <MoreHorizontal className="text-muted-foreground" />
      </div>
    </DropDrawerItem>
  );
}

export function LinkedDataSourceMenuItem({
  view,
}: {
  view: DatabaseLinkedViewConfig;
}) {
  const { Icon: ViewIcon } = getDatabaseViewTypePresentation(view.viewType);

  return (
    <DropDrawerItem disabled>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ViewIcon className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate">{view.viewName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {view.databaseName}
          </div>
        </div>
        <ArrowUpRightIcon
          aria-label="Linked from another database"
          className="size-3 text-muted-foreground"
        />
      </div>
    </DropDrawerItem>
  );
}

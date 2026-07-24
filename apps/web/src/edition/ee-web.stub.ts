/**
 * Community stub for `@zilobase/ee-web`.
 *
 * The commercial Vite build re-aliases `@zilobase/ee-web` to the private
 * `@zilobase/ee-web` package (zilobase-ee). OSS always resolves here so no
 * Enterprise UI ships in the public artifact.
 */
import type { ReactElement } from "react";

export type EESettingsNavItem = {
  title: string;
  href: string;
  icon: "shield" | "globe";
};

export type EESettingsRoute = {
  path: string;
  /** Function component — matches TanStack `RouteComponent`. */
  component: () => ReactElement | null;
};

export function getEESettingsNavItems(): EESettingsNavItem[] {
  return [];
}

export function getEESettingsRoutes(): EESettingsRoute[] {
  return [];
}

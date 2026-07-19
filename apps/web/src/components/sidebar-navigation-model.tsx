import type {
  Page,
  PageDatabase,
  PageDatabaseView,
  PageItemPlacement,
} from "@zilobase/features/pages"
import type { ReactNode } from "react"

import type { PageNavItem } from "@/components/nav-tree"

export type SidebarPageSections = {
  privatePages: PageNavItem[]
  teamspacePages: PageNavItem[]
}

export type SidebarNavigationIcons = {
  getDatabaseIcon: (database: PageDatabase) => ReactNode
  getDatabaseViewIcon: (view: PageDatabaseView) => ReactNode
  getPageIcon: (page: Page) => ReactNode
}

export function buildSidebarNavigation(
  pages: Page[],
  databases: PageDatabase[],
  placements: PageItemPlacement[],
  icons: SidebarNavigationIcons,
) {
  const activePages = pages.filter((page) => !page.deletedAt)
  const activeDatabases = databases.filter((database) => !database.deletedAt)
  const sections = buildPageTreeSections(
    activePages,
    activeDatabases,
    placements,
    icons,
  )

  return {
    favorites: buildFavoriteTreeItems([
      ...sections.privatePages,
      ...sections.teamspacePages,
    ]),
    sections,
  }
}

export function buildPageTreeSections(
  pages: Page[],
  databases: PageDatabase[],
  placements: PageItemPlacement[],
  icons: SidebarNavigationIcons,
): SidebarPageSections {
  const orderedPages = [...pages].sort(
    (first, second) => getPageCreatedTime(first) - getPageCreatedTime(second),
  )
  const pagesById = new Map(orderedPages.map((page) => [page.id, page]))
  const pageNodesById = new Map(
    orderedPages.map((page) => [page.id, createPageNode(page, icons)]),
  )
  const placementsByPageParent = groupPagePlacements(placements)
  const databaseNodesById = new Map(
    databases.map((database) => [
      database.id,
      createDatabaseNode(
        database,
        database.pageId ? pagesById.get(database.pageId) : undefined,
        icons,
      ),
    ]),
  )
  const placedPageIds = new Set<string>()
  const placedDatabaseIds = new Set<string>()
  const databaseRowPageIds = new Set<string>()

  for (const placement of placements) {
    if (placement.itemKind === "page") {
      placedPageIds.add(placement.itemId)
      if (placement.placementKind === "database_row") {
        databaseRowPageIds.add(placement.itemId)
      }
    } else if (placement.parentKind === "page") {
      placedDatabaseIds.add(placement.itemId)
    }
  }

  const buildDatabaseNode = (
    databaseId: string,
    navNodeId: string,
    isLinked = false,
  ): PageNavItem | null => {
    const node = databaseNodesById.get(databaseId)

    return node ? { ...node, isLinked, navNodeId } : null
  }

  const visitingPageIds = new Set<string>()
  const buildPageNode = (
    pageId: string,
    navNodeId: string,
    isLinked = false,
  ): PageNavItem | null => {
    const node = pageNodesById.get(pageId)

    if (!node) {
      return null
    }

    if (visitingPageIds.has(pageId)) {
      return { ...node, isLinked: true, navNodeId }
    }

    visitingPageIds.add(pageId)
    const pages = (placementsByPageParent.get(pageId) ?? []).flatMap(
      (placement) => {
        if (placement.itemKind === "page") {
          if (placement.itemId === pageId) {
            return []
          }

          const child = buildPageNode(
            placement.itemId,
            placement.id,
            placement.placementKind !== "primary" ||
              databaseRowPageIds.has(placement.itemId),
          )

          return child ? [child] : []
        }

        const child = buildDatabaseNode(
          placement.itemId,
          placement.id,
          placement.placementKind !== "primary",
        )

        return child ? [child] : []
      },
    )
    visitingPageIds.delete(pageId)

    return { ...node, isLinked, navNodeId, pages }
  }

  const roots = orderedPages.flatMap((page) => {
    if (placedPageIds.has(page.id)) {
      return []
    }

    const node = buildPageNode(page.id, page.id)
    return node ? [node] : []
  })

  for (const database of databases) {
    if (placedDatabaseIds.has(database.id)) {
      continue
    }

    const node = buildDatabaseNode(
      database.id,
      `standalone-database:${database.id}`,
    )
    if (node) {
      roots.push(node)
    }
  }

  return {
    privatePages: roots.filter((page) => !page.isTeamspace),
    teamspacePages: roots.filter((page) => page.isTeamspace),
  }
}

export function buildFavoriteTreeItems(items: PageNavItem[]) {
  const favoriteItems = items.flatMap((item) =>
    cloneFavoriteTreeItems(item, false),
  )
  const nestedFavoriteIds = new Set<string>()

  for (const item of favoriteItems) {
    collectFavoriteDescendantIds(item, nestedFavoriteIds)
  }

  return favoriteItems.filter((item) => !nestedFavoriteIds.has(item.id))
}

function createPageNode(
  page: Page,
  icons: SidebarNavigationIcons,
): PageNavItem {
  return {
    id: page.id,
    isFavorite: Boolean(page.isFavorite),
    isTeamspace: Boolean(page.isTeamspace),
    name: page.name,
    emoji: icons.getPageIcon(page),
    zilobaseai: page.metadata?.zilobaseai ?? null,
    pageId: page.id,
    pages: [],
  }
}

function createDatabaseNode(
  database: PageDatabase,
  page: Page | undefined,
  icons: SidebarNavigationIcons,
): PageNavItem {
  return {
    databaseId: database.id,
    id: `database:${database.id}`,
    isDatabase: true,
    isFavorite: Boolean(database.isFavorite),
    isTeamspace: Boolean(page?.isTeamspace),
    name: database.name,
    emoji: icons.getDatabaseIcon(database),
    pageId: database.pageId,
    pages: [...(database.views ?? [])]
      .sort((first, second) => first.position - second.position)
      .map((view) => ({
        databaseId: database.id,
        databaseViewId: view.id,
        id: `database-view:${view.id}`,
        isDatabaseView: true,
        isTeamspace: Boolean(page?.isTeamspace),
        name: view.name,
        emoji: icons.getDatabaseViewIcon(view),
        pageId: database.pageId,
        navNodeId: `database-view:${database.id}:${view.id}`,
        pages: [],
      })),
  }
}

function groupPagePlacements(placements: PageItemPlacement[]) {
  const grouped = new Map<string, PageItemPlacement[]>()

  for (const placement of placements) {
    if (placement.parentKind !== "page") {
      continue
    }

    const siblings = grouped.get(placement.parentId)
    if (siblings) {
      siblings.push(placement)
    } else {
      grouped.set(placement.parentId, [placement])
    }
  }

  for (const siblings of grouped.values()) {
    siblings.sort((first, second) =>
      first.position === second.position
        ? first.id.localeCompare(second.id)
        : first.position - second.position,
    )
  }

  return grouped
}

function cloneFavoriteTreeItems(
  item: PageNavItem,
  hasFavoriteAncestor: boolean,
): PageNavItem[] {
  if (item.isDatabaseView) {
    return []
  }

  if (hasFavoriteAncestor || item.isFavorite) {
    return [
      {
        ...item,
        isFavorite: true,
        pages: item.pages.flatMap((page) => cloneFavoriteTreeItems(page, true)),
      },
    ]
  }

  const favoritePages = item.pages.flatMap((page) =>
    cloneFavoriteTreeItems(page, false),
  )

  if (item.isDatabase && favoritePages.length > 0) {
    return [{ ...item, pages: favoritePages }]
  }

  return favoritePages
}

function collectFavoriteDescendantIds(item: PageNavItem, ids: Set<string>) {
  for (const page of item.pages) {
    ids.add(page.id)
    collectFavoriteDescendantIds(page, ids)
  }
}

function getPageCreatedTime(page: Page) {
  const time = new Date(page.createdAt).getTime()
  return Number.isFinite(time) ? time : 0
}

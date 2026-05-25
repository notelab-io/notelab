export type DatabaseBlockOptions = {
  currentPageId?: string | null
  onOpenPage?: (pageId: string) => void
  organizationId?: string | null
}

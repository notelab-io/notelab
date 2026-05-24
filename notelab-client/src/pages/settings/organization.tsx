export default function OrganizationSettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Manage workspace details, billing identity, and defaults.
        </p>
      </div>
    </main>
  )
}

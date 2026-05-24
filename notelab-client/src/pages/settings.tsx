const settingsSections = [
  {
    id: "organization",
    title: "Organization",
    description: "Manage workspace details, billing identity, and defaults.",
  },
  {
    id: "profile",
    title: "Profile",
    description: "Update your personal details and account preferences.",
  },
  {
    id: "team",
    title: "Team",
    description: "Invite collaborators and manage team access.",
  },
]

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your workspace, profile, and team from one place.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        {settingsSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-lg border bg-background p-5"
          >
            <h2 className="text-base font-medium">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
          </section>
        ))}
      </div>
    </main>
  )
}

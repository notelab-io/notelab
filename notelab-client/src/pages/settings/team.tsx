import { SettingsHeader } from "@/components/settings-header"

export default function TeamSettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <SettingsHeader
        title="Team"
        description="Invite collaborators and manage team access."
      />
    </main>
  )
}

import * as React from "react"
import { toast } from "sonner"

import { SettingsHeader } from "@/components/settings-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/lib/api"
import { useActiveOrganizationId } from "@notelab/features/integrations"
import {
  useOrganizations,
  useUpdateOrganization,
} from "@notelab/features/organizations"

export default function OrganizationSettingsPage() {
  const activeOrganizationId = useActiveOrganizationId()
  const { data: organizations = [] } = useOrganizations()
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? null

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <SettingsHeader
        title="Organization"
        description="Manage workspace details, billing identity, and defaults."
      />

      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <OrganizationDetailsCard organization={organization} />
      </div>
    </main>
  )
}

function OrganizationDetailsCard({
  organization,
}: {
  organization: {
    id: string
    logo?: string | null
    metadata?: string | null
    name: string
    slug: string
  } | null
}) {
  const updateOrganization = useUpdateOrganization()
  const [name, setName] = React.useState(organization?.name ?? "")
  const [slug, setSlug] = React.useState(organization?.slug ?? "")
  const [logo, setLogo] = React.useState(organization?.logo ?? "")
  const [metadata, setMetadata] = React.useState(organization?.metadata ?? "")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    setName(organization?.name ?? "")
    setSlug(organization?.slug ?? "")
    setLogo(organization?.logo ?? "")
    setMetadata(organization?.metadata ?? "")
  }, [organization])

  const hasChanges =
    name.trim() !== (organization?.name ?? "").trim() ||
    slug.trim().toLowerCase() !== (organization?.slug ?? "").trim().toLowerCase() ||
    logo.trim() !== (organization?.logo ?? "").trim() ||
    metadata.trim() !== (organization?.metadata ?? "").trim()

  const saveOrganization = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!organization) {
      setError("Select an organization before updating settings.")
      return
    }

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim().toLowerCase()
    const trimmedLogo = logo.trim()
    const trimmedMetadata = metadata.trim()

    if (!trimmedName) {
      setError("Organization name is required.")
      return
    }

    if (!isValidSlug(trimmedSlug)) {
      setError("Use lowercase letters, numbers, and hyphens for the slug.")
      return
    }

    if (trimmedLogo && !isValidUrl(trimmedLogo)) {
      setError("Enter a valid logo URL.")
      return
    }

    setError("")
    updateOrganization.mutate(
      {
        organizationId: organization.id,
        logo: trimmedLogo || null,
        metadata: trimmedMetadata || null,
        name: trimmedName,
        slug: trimmedSlug,
      },
      {
        onSuccess: () => {
          toast.success("Organization updated.")
        },
        onError: (mutationError) => {
          setError(getApiErrorMessage(mutationError))
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace details</CardTitle>
        <CardDescription>
          Update the fields used to identify this organization across Notelab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={saveOrganization}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="organization-name">Organization name</FieldLabel>
              <Input
                disabled={!organization || updateOrganization.isPending}
                id="organization-name"
                onChange={(event) => {
                  setName(event.target.value)
                  if (error) {
                    setError("")
                  }
                }}
                placeholder="Acme Labs"
                value={name}
              />
            </Field>

            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="organization-slug">Slug</FieldLabel>
              <Input
                disabled={!organization || updateOrganization.isPending}
                id="organization-slug"
                onChange={(event) => {
                  setSlug(event.target.value)
                  if (error) {
                    setError("")
                  }
                }}
                placeholder="acme-labs"
                value={slug}
              />
              <FieldDescription>
                Lowercase, numbers, and hyphens only.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="organization-logo">Logo URL</FieldLabel>
              <Input
                disabled={!organization || updateOrganization.isPending}
                id="organization-logo"
                onChange={(event) => {
                  setLogo(event.target.value)
                  if (error) {
                    setError("")
                  }
                }}
                placeholder="https://example.com/logo.png"
                type="url"
                value={logo}
              />
            </Field>

            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="organization-metadata">Metadata</FieldLabel>
              <Textarea
                disabled={!organization || updateOrganization.isPending}
                id="organization-metadata"
                onChange={(event) => {
                  setMetadata(event.target.value)
                  if (error) {
                    setError("")
                  }
                }}
                placeholder="Add any organization-specific notes or identifiers."
                rows={5}
                value={metadata}
              />
              <FieldDescription>
                Optional notes or internal descriptors for this workspace.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>

          <Button
            className="w-fit"
            disabled={!organization || !hasChanges || updateOrganization.isPending}
            type="submit"
          >
            {updateOrganization.isPending ? <Spinner /> : null}
            Save organization
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function isValidUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

import { Input } from "@/components/ui/input";
import type { GithubIntegrationStatus } from "@notelab/features/integrations";
import { integrationIcons } from "@/lib/integration-icons";

import {
  IntegrationDetail,
  IntegrationEmailMatchSetting,
  IntegrationOAuthNotConfiguredAlert,
  IntegrationPersonalAccountCard,
  IntegrationSectionCard,
  IntegrationSectionHeader,
  IntegrationSectionLayout,
  IntegrationWorkspaceActions,
  IntegrationWorkspacePendingAlert,
  isIntegrationConnectBlocked,
} from "../integration-card-sections";
import { useIntegrationConnectionState } from "../use-integration-connection-state";

export function GithubIntegrationCard({
  canManageWorkspace,
  githubOrganizationLogin,
  isBusy,
  onConnectPersonal,
  onConnectWorkspace,
  onDisconnectPersonal,
  onDisconnectWorkspace,
  onOrganizationLoginChange,
  onToggleEmailMatch,
  status,
}: {
  canManageWorkspace: boolean;
  githubOrganizationLogin: string;
  isBusy: boolean;
  onConnectPersonal: () => void;
  onConnectWorkspace: (input: {
    enforceEmailMatch: boolean;
    organizationLogin: string;
  }) => void;
  onDisconnectPersonal: () => void;
  onDisconnectWorkspace: () => void;
  onOrganizationLoginChange: (value: string) => void;
  onToggleEmailMatch: (enabled: boolean) => void;
  status: GithubIntegrationStatus | null;
}) {
  const {
    enforceEmailMatch,
    isPersonalConnected,
    isWorkspaceConnected,
    setPendingEmailMatch,
  } = useIntegrationConnectionState(status);
  const organizationLogin =
    status?.workspace.organizationLogin || githubOrganizationLogin;
  const canConnectWorkspace = organizationLogin.trim().length > 0;

  return (
    <div className="space-y-4">
      <IntegrationSectionCard>
        <IntegrationSectionLayout
          actions={
            <IntegrationWorkspaceActions
              canManageWorkspace={canManageWorkspace}
              connectDisabled={
                isIntegrationConnectBlocked(status) || !canConnectWorkspace
              }
              connectLabel="Connect organization"
              isBusy={isBusy}
              isWorkspaceConnected={isWorkspaceConnected}
              onConnectWorkspace={() =>
                onConnectWorkspace({
                  enforceEmailMatch,
                  organizationLogin,
                })
              }
              onDisconnectWorkspace={onDisconnectWorkspace}
            />
          }
          footer={
            <>
              <IntegrationEmailMatchSetting
                canManageWorkspace={canManageWorkspace}
                checked={enforceEmailMatch}
                disabled={isBusy}
                integrationName="GitHub"
                isWorkspaceConnected={isWorkspaceConnected}
                onApply={onToggleEmailMatch}
                onPendingChange={setPendingEmailMatch}
              />
              <IntegrationWorkspacePendingAlert
                canManageWorkspace={canManageWorkspace}
                isWorkspaceConnected={isWorkspaceConnected}
                memberMessage="GitHub organization is not connected. Ask an admin to connect it before linking your GitHub account."
              />
              <IntegrationOAuthNotConfiguredAlert
                message="GitHub OAuth is not configured on the backend."
                status={status}
              />
            </>
          }
        >
          <IntegrationSectionHeader
            connected={status?.workspace.connected}
            description="Admin-managed GitHub organization connection for repository, issue, pull request, commit, and file context."
            details={
              <>
                <IntegrationDetail
                  label="Organization"
                  value={
                    status?.workspace.organizationLogin ||
                    status?.workspace.organizationName ||
                    "Not connected"
                  }
                />
                <IntegrationDetail
                  label="Organization ID"
                  value={status?.workspace.organizationId || "Not connected"}
                />
                <IntegrationDetail
                  label="Email matching"
                  value={enforceEmailMatch ? "Required" : "Not required"}
                />
                <IntegrationDetail
                  label="Access"
                  value={
                    isWorkspaceConnected
                      ? "Organization verified"
                      : "Not connected"
                  }
                />
              </>
            }
            extra={
              !isWorkspaceConnected && canManageWorkspace ? (
                <div className="max-w-sm space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="github-organization-login"
                  >
                    Organization login
                  </label>
                  <Input
                    disabled={isBusy}
                    id="github-organization-login"
                    onChange={(event) =>
                      onOrganizationLoginChange(event.target.value)
                    }
                    placeholder="acme-inc"
                    value={githubOrganizationLogin}
                  />
                </div>
              ) : null
            }
            iconSrc={integrationIcons.github}
            title="GitHub organization"
          />
        </IntegrationSectionLayout>
      </IntegrationSectionCard>

      <IntegrationPersonalAccountCard
        description="Connect your GitHub identity so Notelab can verify you belong to the connected GitHub organization."
        details={
          <>
            <IntegrationDetail
              label="Account"
              value={
                status?.personal.login ||
                status?.personal.name ||
                "Not connected"
              }
            />
            <IntegrationDetail
              label="Email"
              value={status?.personal.email || "Not connected"}
            />
            <IntegrationDetail
              label="Organization"
              value={
                status?.workspace.organizationLogin ||
                status?.workspace.organizationName ||
                "Organization not connected"
              }
            />
            <IntegrationDetail
              label="Access"
              value={
                isPersonalConnected
                  ? "GitHub identity linked"
                  : "Not connected"
              }
            />
          </>
        }
        iconSrc={integrationIcons.github}
        integrationName="GitHub organization"
        isBusy={isBusy}
        isPersonalConnected={isPersonalConnected}
        isWorkspaceConnected={isWorkspaceConnected}
        onConnectPersonal={onConnectPersonal}
        onDisconnectPersonal={onDisconnectPersonal}
        status={status}
        title="My GitHub account"
      />
    </div>
  );
}
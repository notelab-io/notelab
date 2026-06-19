import type { SlackIntegrationStatus } from "@notelab/features/integrations";
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

export function SlackIntegrationCard({
  canManageWorkspace,
  isBusy,
  onConnectPersonal,
  onConnectWorkspace,
  onDisconnectPersonal,
  onDisconnectWorkspace,
  onToggleEmailMatch,
  status,
}: {
  canManageWorkspace: boolean;
  isBusy: boolean;
  onConnectPersonal: () => void;
  onConnectWorkspace: (enforceEmailMatch: boolean) => void;
  onDisconnectPersonal: () => void;
  onDisconnectWorkspace: () => void;
  onToggleEmailMatch: (enabled: boolean) => void;
  status: SlackIntegrationStatus | null;
}) {
  const {
    enforceEmailMatch,
    isPersonalConnected,
    isWorkspaceConnected,
    setPendingEmailMatch,
  } = useIntegrationConnectionState(status);

  return (
    <div className="space-y-4">
      <IntegrationSectionCard>
        <IntegrationSectionLayout
          actions={
            <IntegrationWorkspaceActions
              canManageWorkspace={canManageWorkspace}
              connectDisabled={isIntegrationConnectBlocked(status)}
              connectLabel="Connect workspace"
              isBusy={isBusy}
              isWorkspaceConnected={isWorkspaceConnected}
              onConnectWorkspace={() => onConnectWorkspace(enforceEmailMatch)}
              onDisconnectWorkspace={onDisconnectWorkspace}
            />
          }
          footer={
            <>
              <IntegrationEmailMatchSetting
                canManageWorkspace={canManageWorkspace}
                checked={enforceEmailMatch}
                disabled={isBusy}
                integrationName="Slack"
                isWorkspaceConnected={isWorkspaceConnected}
                onApply={onToggleEmailMatch}
                onPendingChange={setPendingEmailMatch}
              />
              <IntegrationWorkspacePendingAlert
                canManageWorkspace={canManageWorkspace}
                isWorkspaceConnected={isWorkspaceConnected}
                memberMessage="Slack workspace is not connected. Ask an admin to connect it before linking your Slack account."
              />
              <IntegrationOAuthNotConfiguredAlert
                message="Slack OAuth is not configured on the backend."
                status={status}
              />
            </>
          }
        >
          <IntegrationSectionHeader
            connected={status?.workspace.connected}
            description="Admin-managed Slack app installation for organization channels, files, canvases, and threads the app can access."
            details={
              <>
                <IntegrationDetail
                  label="Workspace"
                  value={
                    status?.workspace.teamName ||
                    status?.workspace.organizationName ||
                    "Not connected"
                  }
                />
                <IntegrationDetail
                  label="Workspace ID"
                  value={
                    status?.workspace.teamId ||
                    status?.workspace.organizationId ||
                    "Not connected"
                  }
                />
                <IntegrationDetail
                  label="Email matching"
                  value={enforceEmailMatch ? "Required" : "Not required"}
                />
                <IntegrationDetail
                  label="Install"
                  value={
                    status?.workspace.isEnterpriseInstall
                      ? "Enterprise install"
                      : "Workspace install"
                  }
                />
              </>
            }
            iconSrc={integrationIcons.slack}
            title="Slack workspace"
          />
        </IntegrationSectionLayout>
      </IntegrationSectionCard>

      <IntegrationPersonalAccountCard
        description="Connect your Slack identity so Notelab can verify you belong to the connected Slack workspace."
        details={
          <>
            <IntegrationDetail
              label="Account"
              value={
                status?.personal.name ||
                status?.personal.email ||
                "Not connected"
              }
            />
            <IntegrationDetail
              label="Email"
              value={status?.personal.email || "Not connected"}
            />
            <IntegrationDetail
              label="Workspace"
              value={
                status?.workspace.teamName ||
                status?.workspace.organizationName ||
                "Workspace not connected"
              }
            />
            <IntegrationDetail
              label="Access"
              value={
                isPersonalConnected ? "Slack identity linked" : "Not connected"
              }
            />
          </>
        }
        iconSrc={integrationIcons.slack}
        integrationName="Slack workspace"
        isBusy={isBusy}
        isPersonalConnected={isPersonalConnected}
        isWorkspaceConnected={isWorkspaceConnected}
        onConnectPersonal={onConnectPersonal}
        onDisconnectPersonal={onDisconnectPersonal}
        status={status}
        title="My Slack account"
      />
    </div>
  );
}
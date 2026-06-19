import type { LinearIntegrationStatus } from "@notelab/features/integrations";
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

export function LinearIntegrationCard({
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
  status: LinearIntegrationStatus | null;
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
                integrationName="Linear"
                isWorkspaceConnected={isWorkspaceConnected}
                onApply={onToggleEmailMatch}
                onPendingChange={setPendingEmailMatch}
              />
              <IntegrationWorkspacePendingAlert
                canManageWorkspace={canManageWorkspace}
                isWorkspaceConnected={isWorkspaceConnected}
                memberMessage="Linear workspace is not connected. Ask an admin to connect it before linking your Linear account."
              />
              <IntegrationOAuthNotConfiguredAlert
                message="Linear OAuth is not configured on the backend."
                status={status}
              />
            </>
          }
        >
          <IntegrationSectionHeader
            connected={status?.workspace.connected}
            description="Admin-managed Linear organization connection. Members can connect their own Linear account after this workspace is connected."
            details={
              <>
                <IntegrationDetail
                  label="Workspace"
                  value={status?.workspace.organizationName || "Not connected"}
                />
                <IntegrationDetail
                  label="Workspace ID"
                  value={status?.workspace.organizationId || "Not connected"}
                />
                <IntegrationDetail
                  label="Email matching"
                  value={enforceEmailMatch ? "Required" : "Not required"}
                />
                <IntegrationDetail
                  label="OAuth"
                  value={status?.configured ? "Configured" : "Not configured"}
                />
              </>
            }
            iconSrc={integrationIcons.linear}
            title="Linear workspace"
          />
        </IntegrationSectionLayout>
      </IntegrationSectionCard>

      <IntegrationPersonalAccountCard
        description="Connect your own Linear identity so AI can read the Linear items your account can access."
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
                status?.workspace.organizationName ||
                "Workspace not connected"
              }
            />
            <IntegrationDetail
              label="Access"
              value={isPersonalConnected ? "Read-only Linear" : "Not connected"}
            />
          </>
        }
        iconSrc={integrationIcons.linear}
        integrationName="Linear workspace"
        isBusy={isBusy}
        isPersonalConnected={isPersonalConnected}
        isWorkspaceConnected={isWorkspaceConnected}
        onConnectPersonal={onConnectPersonal}
        onDisconnectPersonal={onDisconnectPersonal}
        status={status}
        title="My Linear account"
      />
    </div>
  );
}
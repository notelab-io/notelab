import type { GmailIntegrationStatus } from "@notelab/features/integrations";
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

export function GmailIntegrationCard({
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
  status: GmailIntegrationStatus | null;
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
                integrationName="Gmail"
                isWorkspaceConnected={isWorkspaceConnected}
                onApply={onToggleEmailMatch}
                onPendingChange={setPendingEmailMatch}
              />
              <IntegrationWorkspacePendingAlert
                canManageWorkspace={canManageWorkspace}
                isWorkspaceConnected={isWorkspaceConnected}
                memberMessage="Gmail workspace is not connected. Ask an admin to connect it before linking your Gmail account."
              />
              <IntegrationOAuthNotConfiguredAlert
                message="Google OAuth is not configured on the backend."
                status={status}
              />
            </>
          }
        >
          <IntegrationSectionHeader
            connected={status?.workspace.connected}
            description="Admin-managed Google Workspace domain used to validate which Gmail accounts may connect."
            details={
              <>
                <IntegrationDetail
                  label="Domain"
                  value={status?.workspace.hostedDomain || "Not connected"}
                />
                <IntegrationDetail
                  label="Admin account"
                  value={status?.workspace.email || "Not connected"}
                />
                <IntegrationDetail
                  label="Email matching"
                  value={enforceEmailMatch ? "Required" : "Not required"}
                />
                <IntegrationDetail
                  label="Access"
                  value={
                    isWorkspaceConnected
                      ? "Workspace domain verified"
                      : "Not connected"
                  }
                />
              </>
            }
            iconSrc={integrationIcons.gmail}
            title="Gmail workspace"
          />
        </IntegrationSectionLayout>
      </IntegrationSectionCard>

      <IntegrationPersonalAccountCard
        description="Connect your Gmail identity so AI can read messages visible to your Google account."
        details={
          <>
            <IntegrationDetail
              label="Account"
              value={status?.personal.email || "Not connected"}
            />
            <IntegrationDetail
              label="Domain"
              value={status?.personal.hostedDomain || "Not verified"}
            />
            <IntegrationDetail
              label="Workspace"
              value={
                status?.workspace.hostedDomain || "Workspace not connected"
              }
            />
            <IntegrationDetail
              label="Access"
              value={
                isPersonalConnected ? "Gmail account linked" : "Not connected"
              }
            />
          </>
        }
        iconSrc={integrationIcons.gmail}
        integrationName="Gmail workspace"
        isBusy={isBusy}
        isPersonalConnected={isPersonalConnected}
        isWorkspaceConnected={isWorkspaceConnected}
        onConnectPersonal={onConnectPersonal}
        onDisconnectPersonal={onDisconnectPersonal}
        status={status}
        title="My Gmail account"
      />
    </div>
  );
}
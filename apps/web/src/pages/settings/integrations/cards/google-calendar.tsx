import * as React from "react";

import type { GoogleCalendarIntegrationStatus } from "@notelab/features/integrations";
import { integrationIcons } from "@/lib/integration-icons";

import {
  IntegrationDetail,
  IntegrationEmailMatchSetting,
  IntegrationOAuthNotConfiguredAlert,
  IntegrationPersonalAccountCard,
  IntegrationSectionCard,
  IntegrationSectionHeader,
  IntegrationSectionLayout,
  IntegrationSettingToggle,
  IntegrationWorkspaceActions,
  IntegrationWorkspacePendingAlert,
  isIntegrationConnectBlocked,
} from "../integration-card-sections";
import { useIntegrationConnectionState } from "../use-integration-connection-state";

export function GoogleCalendarIntegrationCard({
  canManageWorkspace,
  isBusy,
  onConnectPersonal,
  onConnectWorkspace,
  onDisconnectPersonal,
  onDisconnectWorkspace,
  onToggleCoworkerAccess,
  onToggleEmailMatch,
  status,
}: {
  canManageWorkspace: boolean;
  isBusy: boolean;
  onConnectPersonal: () => void;
  onConnectWorkspace: (input: {
    coworkerCalendarAccessEnabled: boolean;
    enforceEmailMatch: boolean;
  }) => void;
  onDisconnectPersonal: () => void;
  onDisconnectWorkspace: () => void;
  onToggleCoworkerAccess: (enabled: boolean) => void;
  onToggleEmailMatch: (enabled: boolean) => void;
  status: GoogleCalendarIntegrationStatus | null;
}) {
  const {
    enforceEmailMatch,
    isPersonalConnected,
    isWorkspaceConnected,
    setPendingEmailMatch,
  } = useIntegrationConnectionState(status);
  const [pendingCoworkerAccess, setPendingCoworkerAccess] =
    React.useState(false);
  const coworkerAccessEnabled = isWorkspaceConnected
    ? status?.workspace.coworkerCalendarAccessEnabled === true
    : pendingCoworkerAccess;

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
              onConnectWorkspace={() =>
                onConnectWorkspace({
                  coworkerCalendarAccessEnabled: coworkerAccessEnabled,
                  enforceEmailMatch,
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
                integrationName="Google"
                isWorkspaceConnected={isWorkspaceConnected}
                onApply={onToggleEmailMatch}
                onPendingChange={setPendingEmailMatch}
              />
              <IntegrationSettingToggle
                checked={coworkerAccessEnabled}
                description="Allow AI to check free/busy blocks for other organization calendars."
                disabled={isBusy || !canManageWorkspace}
                onCheckedChange={(checked) => {
                  if (isWorkspaceConnected) {
                    onToggleCoworkerAccess(checked);
                  } else {
                    setPendingCoworkerAccess(checked);
                  }
                }}
                title="Coworker calendar availability"
              />
              <IntegrationWorkspacePendingAlert
                canManageWorkspace={canManageWorkspace}
                isWorkspaceConnected={isWorkspaceConnected}
                memberMessage="Google Calendar workspace is not connected. Ask an admin to connect it before linking your calendar account."
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
            description="Admin-managed Google Workspace domain and calendar policy for personal calendar accounts."
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
                  label="Coworkers"
                  value={
                    coworkerAccessEnabled
                      ? "Availability enabled"
                      : "Personal calendar only"
                  }
                />
              </>
            }
            iconSrc={integrationIcons.googleCalendar}
            title="Google Calendar workspace"
          />
        </IntegrationSectionLayout>
      </IntegrationSectionCard>

      <IntegrationPersonalAccountCard
        description="Connect your Calendar identity so AI can read events visible to your Google account."
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
                isPersonalConnected
                  ? "Calendar account linked"
                  : "Not connected"
              }
            />
          </>
        }
        iconSrc={integrationIcons.googleCalendar}
        integrationName="Google Calendar workspace"
        isBusy={isBusy}
        isPersonalConnected={isPersonalConnected}
        isWorkspaceConnected={isWorkspaceConnected}
        onConnectPersonal={onConnectPersonal}
        onDisconnectPersonal={onDisconnectPersonal}
        status={status}
        title="My Google Calendar account"
      />
    </div>
  );
}
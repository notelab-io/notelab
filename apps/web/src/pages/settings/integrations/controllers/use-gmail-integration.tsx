import * as React from "react";

import { useUpdateGmailIntegrationSettings } from "@notelab/features/integrations";
import type { GmailIntegrationStatus } from "@notelab/features/integrations";
import { integrationIcons } from "@/lib/integration-icons";

import { GmailIntegrationCard } from "../cards/gmail";
import type { IntegrationSummary } from "../types";
import {
  toastEmailMatchToggle,
  useIntegrationBusyState,
  useIntegrationOAuthActions,
} from "./use-integration-oauth-actions";
import type { IntegrationControllerContext } from "./types";

export function useGmailIntegrationController({
  canManageWorkspace,
  isLoadingIntegrations,
  setIntegrationsError,
  setSelectedIntegrationId,
  status,
}: IntegrationControllerContext & {
  status: GmailIntegrationStatus | null;
}) {
  const updateSettings = useUpdateGmailIntegrationSettings();
  const {
    connectPersonal,
    connectWorkspace,
    disconnectIntegration,
    disconnectPersonal,
    disconnectWorkspace,
    endpointId,
    runWithIntegrationError,
    startOAuth,
  } = useIntegrationOAuthActions({
    integrationId: "gmail",
    setIntegrationsError,
  });
  const isBusy = useIntegrationBusyState({
    disconnectIntegration,
    endpointId,
    isLoadingIntegrations,
    settingsPending: updateSettings.isPending,
    startOAuth,
  });

  const toggleEmailMatch = React.useCallback(
    async (enforceEmailMatch: boolean) => {
      await runWithIntegrationError(async () => {
        const result = await updateSettings.mutateAsync({ enforceEmailMatch });
        toastEmailMatchToggle({
          enabled: enforceEmailMatch,
          integrationName: "Gmail",
          removedPersonalConnections: result.removedPersonalConnections,
        });
      });
    },
    [runWithIntegrationError, updateSettings],
  );

  const summary: IntegrationSummary = {
    about:
      "Gmail lets Notelab read messages visible to the connected Google account so AI answers can include email context.",
    category: "AI enterprise search",
    connected: status?.workspace.connected,
    connectDisabled:
      isBusy || status?.configured === false || status?.needsMigration === true,
    connectLabel: "Connect Gmail",
    detail:
      status?.workspace.hostedDomain ||
      status?.personal.email ||
      "Read Gmail messages for AI workspace research.",
    id: "gmail",
    icon: integrationIcons.gmail,
    isBusy,
    name: "Gmail",
    onConnect: () =>
      canManageWorkspace
        ? void connectWorkspace({
            enforceEmailMatch: status?.workspace.enforceEmailMatch ?? true,
          })
        : void connectPersonal(),
    onManage: () => setSelectedIntegrationId("gmail"),
  };

  const card = (
    <GmailIntegrationCard
      canManageWorkspace={canManageWorkspace}
      isBusy={isBusy}
      onConnectPersonal={() => void connectPersonal()}
      onConnectWorkspace={(enabled) =>
        void connectWorkspace({ enforceEmailMatch: enabled })
      }
      onDisconnectPersonal={() =>
        void disconnectPersonal("Gmail account disconnected.")
      }
      onDisconnectWorkspace={() =>
        void disconnectWorkspace("Gmail workspace disconnected.")
      }
      onToggleEmailMatch={(enabled) => void toggleEmailMatch(enabled)}
      status={status}
    />
  );

  return { card, isBusy, summary };
}
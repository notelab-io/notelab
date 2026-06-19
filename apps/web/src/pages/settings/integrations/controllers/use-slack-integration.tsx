import * as React from "react";

import { useUpdateSlackIntegrationSettings } from "@notelab/features/integrations";
import type { SlackIntegrationStatus } from "@notelab/features/integrations";
import { integrationIcons } from "@/lib/integration-icons";

import { SlackIntegrationCard } from "../cards/slack";
import type { IntegrationSummary } from "../types";
import {
  toastEmailMatchToggle,
  useIntegrationBusyState,
  useIntegrationOAuthActions,
} from "./use-integration-oauth-actions";
import type { IntegrationControllerContext } from "./types";

export function useSlackIntegrationController({
  canManageWorkspace,
  isLoadingIntegrations,
  setIntegrationsError,
  setSelectedIntegrationId,
  status,
}: IntegrationControllerContext & {
  status: SlackIntegrationStatus | null;
}) {
  const updateSettings = useUpdateSlackIntegrationSettings();
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
    integrationId: "slack",
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
          integrationName: "Slack",
          removedPersonalConnections: result.removedPersonalConnections,
        });
      });
    },
    [runWithIntegrationError, updateSettings],
  );

  const summary: IntegrationSummary = {
    about:
      "Slack gives Notelab access to the channels, files, canvases, and threads the installed app can see. Personal DMs stay outside this organization connector.",
    category: "AI enterprise search",
    connected: status?.workspace.connected,
    connectDisabled:
      isBusy || status?.configured === false || status?.needsMigration === true,
    connectLabel: "Connect Slack",
    detail:
      status?.workspace.teamName ||
      status?.workspace.organizationName ||
      status?.personal.email ||
      "Read workspace conversations and shared files.",
    id: "slack",
    icon: integrationIcons.slack,
    isBusy,
    name: "Slack",
    onConnect: () =>
      canManageWorkspace
        ? void connectWorkspace({
            enforceEmailMatch: status?.workspace.enforceEmailMatch ?? true,
          })
        : void connectPersonal(),
    onManage: () => setSelectedIntegrationId("slack"),
  };

  const card = (
    <SlackIntegrationCard
      canManageWorkspace={canManageWorkspace}
      isBusy={isBusy}
      onConnectPersonal={() => void connectPersonal()}
      onConnectWorkspace={(enabled) =>
        void connectWorkspace({ enforceEmailMatch: enabled })
      }
      onDisconnectPersonal={() =>
        void disconnectPersonal("Slack account disconnected.")
      }
      onDisconnectWorkspace={() =>
        void disconnectWorkspace("Slack workspace disconnected.")
      }
      onToggleEmailMatch={(enabled) => void toggleEmailMatch(enabled)}
      status={status}
    />
  );

  return { card, isBusy, summary };
}
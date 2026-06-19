import * as React from "react";

import { useUpdateLinearIntegrationSettings } from "@notelab/features/integrations";
import type { LinearIntegrationStatus } from "@notelab/features/integrations";
import { integrationIcons } from "@/lib/integration-icons";

import { LinearIntegrationCard } from "../cards/linear";
import type { IntegrationSummary } from "../types";
import {
  toastEmailMatchToggle,
  useIntegrationBusyState,
  useIntegrationOAuthActions,
} from "./use-integration-oauth-actions";
import type { IntegrationControllerContext } from "./types";

export function useLinearIntegrationController({
  canManageWorkspace,
  isLoadingIntegrations,
  setIntegrationsError,
  setSelectedIntegrationId,
  status,
}: IntegrationControllerContext & {
  status: LinearIntegrationStatus | null;
}) {
  const updateSettings = useUpdateLinearIntegrationSettings();
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
    integrationId: "linear",
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

        if (enforceEmailMatch && result.removedPersonalConnections > 0) {
          toastEmailMatchToggle({
            enabled: enforceEmailMatch,
            integrationName: "Linear",
            removedPersonalConnections: result.removedPersonalConnections,
          });
        } else {
          toastEmailMatchToggle({
            enabled: enforceEmailMatch,
            integrationName: "Linear",
          });
        }
      });
    },
    [runWithIntegrationError, updateSettings],
  );

  const summary: IntegrationSummary = {
    about:
      "Linear connects issues, projects, teams, and cycles so Notelab can answer with current product and planning context.",
    category: "AI enterprise search",
    connected: status?.workspace.connected,
    connectDisabled:
      isBusy || status?.configured === false || status?.needsMigration === true,
    connectLabel: "Connect Linear",
    detail:
      status?.workspace.organizationName ||
      status?.personal.email ||
      "Read planning and delivery context from Linear.",
    id: "linear",
    icon: integrationIcons.linear,
    isBusy,
    name: "Linear",
    onConnect: () =>
      canManageWorkspace
        ? void connectWorkspace({
            enforceEmailMatch: status?.workspace.enforceEmailMatch ?? true,
          })
        : void connectPersonal(),
    onManage: () => setSelectedIntegrationId("linear"),
  };

  const card = (
    <LinearIntegrationCard
      canManageWorkspace={canManageWorkspace}
      isBusy={isBusy}
      onConnectPersonal={() => void connectPersonal()}
      onConnectWorkspace={(enabled) =>
        void connectWorkspace({ enforceEmailMatch: enabled })
      }
      onDisconnectPersonal={() =>
        void disconnectPersonal("Linear account disconnected.")
      }
      onDisconnectWorkspace={() =>
        void disconnectWorkspace("Linear workspace disconnected.")
      }
      onToggleEmailMatch={(enabled) => void toggleEmailMatch(enabled)}
      status={status}
    />
  );

  return { card, isBusy, summary };
}
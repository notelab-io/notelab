import * as React from "react";

type DualConnectionStatus = {
  personal: {
    connected?: boolean;
  };
  workspace: {
    connected?: boolean;
    enforceEmailMatch?: boolean;
  };
} | null;

export function useIntegrationConnectionState(status: DualConnectionStatus) {
  const isWorkspaceConnected = status?.workspace.connected === true;
  const isPersonalConnected = status?.personal.connected === true;
  const [pendingEmailMatch, setPendingEmailMatch] = React.useState(true);
  const enforceEmailMatch = isWorkspaceConnected
    ? status?.workspace.enforceEmailMatch === true
    : pendingEmailMatch;

  return {
    enforceEmailMatch,
    isPersonalConnected,
    isWorkspaceConnected,
    pendingEmailMatch,
    setPendingEmailMatch,
  };
}
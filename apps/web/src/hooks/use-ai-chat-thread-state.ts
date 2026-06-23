import { useActiveOrganizationId } from "@notelab/features/integrations";
import {
  useAiChatThreads,
  useCreateAiChatThread,
} from "@notelab/features/ai-chat";
import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { create } from "zustand";

type StoredAiChatThreadState = {
  activeThreadId: string | null;
  bootstrapped: boolean;
};

type AiChatThreadStore = {
  threadStateByOrganizationId: Record<
    string,
    StoredAiChatThreadState | undefined
  >;
};

const emptyThreadState: StoredAiChatThreadState = {
  activeThreadId: null,
  bootstrapped: false,
};

const useAiChatThreadStore = create<AiChatThreadStore>()(() => ({
  threadStateByOrganizationId: {},
}));

function updateStoredThreadState(
  organizationId: string,
  getNext: (current: StoredAiChatThreadState) => StoredAiChatThreadState,
) {
  useAiChatThreadStore.setState((state) => {
    const current =
      state.threadStateByOrganizationId[organizationId] ?? emptyThreadState;
    const next = getNext(current);

    if (next === current) {
      return state;
    }

    return {
      threadStateByOrganizationId: {
        ...state.threadStateByOrganizationId,
        [organizationId]: next,
      },
    };
  });
}

function initializeActiveThreadId(
  organizationId: string,
  threadId: string | null,
) {
  useAiChatThreadStore.setState((state) => {
    if (state.threadStateByOrganizationId[organizationId]) {
      return state;
    }

    return {
      threadStateByOrganizationId: {
        ...state.threadStateByOrganizationId,
        [organizationId]: { activeThreadId: threadId, bootstrapped: false },
      },
    };
  });
}

function setStoredActiveThreadId(
  organizationId: string,
  threadId: string | null,
) {
  updateStoredThreadState(organizationId, (current) =>
    current.activeThreadId === threadId
      ? current
      : { ...current, activeThreadId: threadId },
  );
}

function clearBootstrapped(organizationId: string) {
  updateStoredThreadState(organizationId, (current) =>
    current.bootstrapped ? { ...current, bootstrapped: false } : current,
  );
}

function markBootstrapped(organizationId: string) {
  const current =
    useAiChatThreadStore.getState().threadStateByOrganizationId[
      organizationId
    ] ?? emptyThreadState;

  if (current.bootstrapped) {
    return false;
  }

  updateStoredThreadState(organizationId, (latest) => ({
    ...latest,
    bootstrapped: true,
  }));

  return true;
}

function getStorageKey(organizationId: string) {
  return `ai-chat-thread:${organizationId}`;
}

function getCurrentUrlThreadId() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    new URLSearchParams(window.location.search).get("thread")?.trim() || null
  );
}

function replaceAiThreadSearchParam(threadId: string | null) {
  if (typeof window === "undefined" || window.location.pathname !== "/ai") {
    return;
  }

  const url = new URL(window.location.href);

  if (threadId) {
    url.searchParams.set("thread", threadId);
  } else {
    url.searchParams.delete("thread");
  }

  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function useAiChatThreadState() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const organizationId = useActiveOrganizationId();
  const threadsQuery = useAiChatThreads();
  const createThread = useCreateAiChatThread();
  const threadState = useAiChatThreadStore((state) =>
    organizationId
      ? state.threadStateByOrganizationId[organizationId]
      : undefined,
  );

  const activeThreadId = threadState?.activeThreadId ?? null;
  const hasInitializedActiveThread = Boolean(threadState);
  const hasBootstrappedActiveThread = Boolean(threadState?.bootstrapped);

  const setActiveThreadId = useCallback(
    (threadId: string | null) => {
      if (!organizationId) {
        return;
      }

      setStoredActiveThreadId(organizationId, threadId);

      if (threadId) {
        sessionStorage.setItem(getStorageKey(organizationId), threadId);
      } else {
        sessionStorage.removeItem(getStorageKey(organizationId));
      }

      if (pathname === "/ai") {
        replaceAiThreadSearchParam(threadId);
      }
    },
    [organizationId, pathname],
  );

  useEffect(() => {
    if (!organizationId || hasInitializedActiveThread) {
      return;
    }

    const storedThreadId = sessionStorage.getItem(getStorageKey(organizationId));
    const initialThreadId =
      pathname === "/ai"
        ? getCurrentUrlThreadId() ?? storedThreadId
        : storedThreadId;

    initializeActiveThreadId(organizationId, initialThreadId);

    if (initialThreadId) {
      sessionStorage.setItem(getStorageKey(organizationId), initialThreadId);
    }
  }, [hasInitializedActiveThread, organizationId, pathname]);

  useEffect(() => {
    if (
      !organizationId ||
      !hasInitializedActiveThread ||
      hasBootstrappedActiveThread ||
      threadsQuery.isLoading
    ) {
      return;
    }

    const threads = threadsQuery.data?.threads ?? [];

    if (
      activeThreadId &&
      threads.some((thread) => thread.id === activeThreadId)
    ) {
      markBootstrapped(organizationId);
      return;
    }

    if (threads.length > 0) {
      if (markBootstrapped(organizationId)) {
        setActiveThreadId(threads[0].id);
      }

      return;
    }

    if (createThread.isPending || !markBootstrapped(organizationId)) {
      return;
    }

    void createThread
      .mutateAsync({})
      .then((response) => {
        setActiveThreadId(response.thread.id);
      })
      .catch(() => {
        clearBootstrapped(organizationId);
      });
  }, [
    activeThreadId,
    createThread,
    hasBootstrappedActiveThread,
    hasInitializedActiveThread,
    organizationId,
    setActiveThreadId,
    threadsQuery.data?.threads,
    threadsQuery.isLoading,
  ]);

  return {
    activeThreadId,
    isBootstrapping:
      !organizationId ||
      !hasInitializedActiveThread ||
      !hasBootstrappedActiveThread ||
      threadsQuery.isLoading ||
      createThread.isPending ||
      !activeThreadId,
    setActiveThreadId,
    threadsQuery,
  };
}

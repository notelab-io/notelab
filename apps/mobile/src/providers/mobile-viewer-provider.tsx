import * as React from 'react';

export type MobileViewerItem = {
  id: string;
  title: string;
  url: string;
};

type MobileViewerContextValue = {
  closeItem: () => void;
  openItem: (item: MobileViewerItem) => void;
  selectedItem: MobileViewerItem | null;
};

const MobileViewerContext = React.createContext<MobileViewerContextValue | null>(null);

export function MobileViewerProvider({ children }: React.PropsWithChildren) {
  const [selectedItem, setSelectedItem] = React.useState<MobileViewerItem | null>(null);

  const value = React.useMemo<MobileViewerContextValue>(
    () => ({
      closeItem: () => setSelectedItem(null),
      openItem: (item) => setSelectedItem(item),
      selectedItem,
    }),
    [selectedItem]
  );

  return <MobileViewerContext.Provider value={value}>{children}</MobileViewerContext.Provider>;
}

export function useMobileViewer() {
  const context = React.useContext(MobileViewerContext);

  if (!context) {
    throw new Error('useMobileViewer must be used inside MobileViewerProvider.');
  }

  return context;
}

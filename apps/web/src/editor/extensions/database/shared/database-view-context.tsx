import { createContext, useContext, type ReactNode } from "react"

type DatabaseViewContextValue = Record<string, any>

const DatabaseViewContext = createContext<DatabaseViewContextValue | null>(null)

export function DatabaseViewProvider({
  children,
  value,
}: {
  children: ReactNode
  value: DatabaseViewContextValue
}) {
  return (
    <DatabaseViewContext.Provider value={value}>
      {children}
    </DatabaseViewContext.Provider>
  )
}

export function useDatabaseViewContext() {
  const value = useContext(DatabaseViewContext)

  if (!value) {
    throw new Error("useDatabaseViewContext must be used inside DatabaseViewProvider")
  }

  return value
}

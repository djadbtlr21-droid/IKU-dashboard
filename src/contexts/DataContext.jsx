import { createContext, useContext, useState } from 'react'

const DataContext = createContext(null)

const INITIAL = {
  currentPage: 'overview',
  moList: [],
  filteredMonth: null,
  kpi: { totalMo: 0, inProgress: 0, completed: 0, delayed: 0 },
  factoryStats: [],
  pipelineStats: [],
}

export function DataProvider({ children }) {
  const [data, setData] = useState(INITIAL)
  return (
    <DataContext.Provider value={{ data, setData }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) return { data: INITIAL, setData: () => {} }
  return ctx
}

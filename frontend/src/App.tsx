import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FlowDashboardPage } from './features/flow-dashboard/FlowDashboardPage'
import { FlowEditorPage } from './features/flow-editor/FlowEditorPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Navigate replace to="/flows" />} path="/" />
          <Route element={<FlowDashboardPage />} path="/flows" />
          <Route element={<FlowEditorPage />} path="/flows/:flowId" />
          <Route element={<Navigate replace to="/flows" />} path="*" />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

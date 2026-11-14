import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { PresenceProvider } from '../contexts/PresenceContext'

export default function Layout() {
  return (
    <PresenceProvider>
      <div className="flex h-screen overflow-hidden bg-[#f0f1f9]">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </PresenceProvider>
  )
}

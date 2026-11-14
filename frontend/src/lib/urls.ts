/// <reference types="vite/client" />
// In development: API goes through Vite proxy (empty base), WS hits localhost directly.
// In production: both use the deployed Render backend URL from env vars.

const apiBase = import.meta.env.VITE_API_URL ?? ''
const wsProto = apiBase.startsWith('https') ? 'wss' : 'ws'
export const WS_BASE = apiBase
  ? `${wsProto}://${apiBase.replace(/^https?:\/\//, '')}`
  : 'ws://localhost:8001'
export const API_BASE = apiBase

'use client'

import { Loader2 } from 'lucide-react'

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sidebarActiveBg" />
        <p className="text-bodyText mt-4">Loading...</p>
      </div>
    </div>
  )
}


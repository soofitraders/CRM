'use client'

import { useState, useEffect } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import '@/styles/grid-layout.css'
import WidgetRenderer from './WidgetRenderer'
import WidgetConfigModal, { WidgetType, TimeRange } from './WidgetConfigModal'
import ShareWidgetModal from './ShareWidgetModal'
import { Plus, Settings, Trash2, Share2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logger } from '@/lib/utils/logger'

interface Widget {
  _id: string
  type: WidgetType
  title: string
  config: {
    timeRange?: TimeRange
    limit?: number
    [key: string]: any
  }
  position: {
    x: number
    y: number
    w: number
    h: number
  }
  isShared?: boolean
  sharedWithRoles?: string[]
}

export default function DashboardGrid() {
  const [layout, setLayout] = useState<Layout[]>([])
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharingWidget, setSharingWidget] = useState<Widget | null>(null)
  const [gridWidth, setGridWidth] = useState(1200)
  const [isMounted, setIsMounted] = useState(false)
  const queryClient = useQueryClient()

  // Ensure component is mounted on client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Calculate grid width based on viewport
  useEffect(() => {
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        // Subtract sidebar width (256px) and padding
        setGridWidth(window.innerWidth - 320)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Fetch widgets
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/dashboard/widgets?includeShared=true')
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch widgets' }))
          throw new Error(errorData.error || 'Failed to fetch widgets')
        }
        const result = await response.json()
        return result.widgets || []
      } catch (error: any) {
        logger.error('Error fetching widgets:', error)
        return []
      }
    },
  })

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setWidgets(data)
      if (data.length > 0) {
        setLayout(
          data.map((widget: Widget) => ({
            i: widget._id,
            x: widget.position?.x || 0,
            y: widget.position?.y || 0,
            w: widget.position?.w || 4,
            h: widget.position?.h || 3,
          }))
        )
      } else {
        setLayout([])
      }
    }
  }, [data])

  // Create widget mutation
  const createMutation = useMutation({
    mutationFn: async (config: { type: WidgetType; title: string; config: any }) => {
      const response = await fetch('/api/dashboard/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          position: { x: 0, y: 0, w: 4, h: 3 },
        }),
      })
      if (!response.ok) throw new Error('Failed to create widget')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] })
      setShowConfigModal(false)
    },
  })

  // Update widget mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await fetch(`/api/dashboard/widgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update widget')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] })
      setShowConfigModal(false)
      setEditingWidget(null)
    },
  })

  // Delete widget mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/dashboard/widgets/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete widget')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] })
    },
  })

  // Update layout mutation
  const updateLayoutMutation = useMutation({
    mutationFn: async (newLayout: Layout[]) => {
      // Update all widget positions
      const updates = newLayout.map((item) => {
        const widget = widgets.find((w) => w._id === item.i)
        if (!widget) return null
        return fetch(`/api/dashboard/widgets/${item.i}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position: {
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            },
          }),
        })
      })
      await Promise.all(updates.filter(Boolean))
    },
  })

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout)
    // Debounce the API call
    setTimeout(() => {
      updateLayoutMutation.mutate(newLayout)
    }, 1000)
  }

  const handleAddWidget = () => {
    setEditingWidget(null)
    setShowConfigModal(true)
  }

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget)
    setShowConfigModal(true)
  }

  const handleDeleteWidget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this widget?')) return
    deleteMutation.mutate(id)
  }

  const handleShareWidget = (widget: Widget) => {
    setSharingWidget(widget)
    setShowShareModal(true)
  }

  const handleSaveShare = async (isShared: boolean, sharedWithRoles: string[]) => {
    if (!sharingWidget) return
    updateMutation.mutate({
      id: sharingWidget._id,
      updates: {
        isShared,
        sharedWithRoles,
      },
    })
  }

  const handleSaveWidget = (config: { type: WidgetType; title: string; config: any }) => {
    if (editingWidget) {
      updateMutation.mutate({
        id: editingWidget._id,
        updates: config,
      })
    } else {
      createMutation.mutate(config)
    }
  }

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Dashboard</h1>
          <p className="text-bodyText text-base">Customizable real-time business metrics</p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebarActiveBg"></div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Dashboard</h1>
          <p className="text-bodyText text-base">Customizable real-time business metrics</p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebarActiveBg"></div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Dashboard</h1>
          <p className="text-bodyText text-base">Customizable real-time business metrics</p>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error loading dashboard</p>
          <p className="text-sm mt-1">{fetchError.message || 'Failed to load widgets'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Dashboard</h1>
          <p className="text-bodyText text-base">Customizable real-time business metrics</p>
        </div>
        <button
          onClick={handleAddWidget}
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-borderSoft rounded-lg">
          <p className="text-bodyText mb-4">No widgets configured</p>
          <button
            onClick={handleAddWidget}
            className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90"
          >
            Add Your First Widget
          </button>
        </div>
      ) : isMounted && layout.length > 0 && gridWidth > 0 ? (
        <div className="relative w-full">
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            isDraggable={true}
            isResizable={true}
            draggableHandle=".widget-drag-handle"
            margin={[16, 16]}
          >
            {widgets.map((widget) => (
              <div key={widget._id} className="relative group">
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleShareWidget(widget)}
                    className="p-1.5 bg-cardBg border border-borderSoft rounded hover:bg-sidebarMuted/10"
                    title="Share"
                  >
                    <Share2 className="w-3 h-3 text-bodyText" />
                  </button>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1.5 bg-cardBg border border-borderSoft rounded hover:bg-sidebarMuted/10"
                    title="Edit"
                  >
                    <Settings className="w-3 h-3 text-bodyText" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget._id)}
                    className="p-1.5 bg-cardBg border border-borderSoft rounded hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
                <div className="widget-drag-handle cursor-move absolute top-2 left-2 w-6 h-6 bg-sidebarMuted/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <WidgetRenderer widget={widget} />
              </div>
            ))}
          </GridLayout>
        </div>
      ) : (
        <div className="text-center py-8 text-bodyText">Loading layout...</div>
      )}

      <WidgetConfigModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false)
          setEditingWidget(null)
        }}
        onSave={handleSaveWidget}
        existingWidget={editingWidget || undefined}
      />

      <ShareWidgetModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false)
          setSharingWidget(null)
        }}
        onSave={handleSaveShare}
        existingWidget={sharingWidget ? { ...sharingWidget, isShared: sharingWidget.isShared ?? false, sharedWithRoles: sharingWidget.sharedWithRoles ?? [] } : undefined}
      />
    </div>
  )
}


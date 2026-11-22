'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  Trash2,
  Package,
  Calendar,
  AlertTriangle,
  CreditCard,
  FileHeart,
  ShieldAlert,
  Info,
  ExternalLink,
  Store,
  User as UserIcon,
} from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils/cn'
import { playClickSound, playNotificationSound } from '@/lib/sound/sound-effects'
import type { NotificationItem, NotificationSummary } from '@/lib/notifications/notification-service'

function formatTimeAgo(dateString: string | Date): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}h ago`
    const diffDays = Math.floor(diffHour / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

export function NotificationPopover() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'stock' | 'dues'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [summary, setSummary] = useState<NotificationSummary | null>(null)

  const prevUnreadRef = useRef<number>(0)
  const isInitialMount = useRef<boolean>(true)

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!session?.user?.id) return
    try {
      if (!silent) setLoading(true)
      const res = await fetch('/api/notifications', { method: 'GET', cache: 'no-store' })
      const data = await res.json()

      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications)
        const newUnread = Number(data.unreadCount) || 0
        setUnreadCount(newUnread)
        setSummary(data.summary || null)

        // Audio chime if unread count increased after initial load
        if (!isInitialMount.current && newUnread > prevUnreadRef.current) {
          playNotificationSound()
        }
        prevUnreadRef.current = newUnread
        isInitialMount.current = false
      }
    } catch (err) {
      console.error('[NotificationPopover] Failed to fetch:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session?.user?.id])

  // Initial fetch and user login synchronization
  useEffect(() => {
    if (session?.user?.id) {
      isInitialMount.current = true
      fetchNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [session?.user?.id, fetchNotifications])

  // Periodic polling every 30 seconds + window focus listener + custom app event
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications(true)
    }, 30000)

    const onFocus = () => fetchNotifications(true)
    const onCustomRefresh = () => fetchNotifications(true)

    window.addEventListener('focus', onFocus)
    window.addEventListener('mpharm:notification-refresh', onCustomRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('mpharm:notification-refresh', onCustomRefresh)
    }
  }, [fetchNotifications])

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    playClickSound()

    // Optimistic UI update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      fetchNotifications(true)
    }
  }

  const handleMarkAllAsRead = async () => {
    playClickSound()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date() })))
    setUnreadCount(0)

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      fetchNotifications(true)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()

    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
      fetchNotifications(true)
    } catch {
      fetchNotifications(true)
    }
  }

  const handleClearRead = async () => {
    playClickSound()
    setNotifications(prev => prev.filter(n => !n.isRead))
    try {
      await fetch('/api/notifications?clearRead=true', { method: 'DELETE' })
      fetchNotifications(true)
    } catch {
      fetchNotifications(true)
    }
  }

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id)
    }
    const targetLink = item.data?.link
    if (targetLink && typeof targetLink === 'string') {
      setIsOpen(false)
      router.push(targetLink)
    }
  }

  // Filter items according to active tab
  const filteredNotifications = notifications.filter(item => {
    if (activeTab === 'unread') return !item.isRead
    if (activeTab === 'stock') return item.type === 'LOW_STOCK' || item.type === 'EXPIRY_ALERT'
    if (activeTab === 'dues')
      return (
        item.type === 'PAYMENT_DUE' ||
        item.type === 'PURCHASE_DUE' ||
        item.type === 'PRESCRIPTION_PENDING' ||
        item.type === 'SYSTEM'
      )
    return true
  })

  const getItemVisuals = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return {
          icon: <Package className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300',
          badgeText: 'Low Stock',
        }
      case 'EXPIRY_ALERT':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
          badgeText: 'Near Expiry',
        }
      case 'PAYMENT_DUE':
      case 'PURCHASE_DUE':
        return {
          icon: <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
          bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
          badgeText: 'Payment Due',
        }
      case 'PRESCRIPTION_PENDING':
        return {
          icon: <FileHeart className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
          bg: 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300',
          badgeText: 'Refill Due',
        }
      case 'SYSTEM':
      default:
        return {
          icon: <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
          badgeText: 'System Alert',
        }
    }
  }

  const roleName = session?.user?.roles?.[0] || (session?.user?.isSuperAdmin ? 'SuperAdmin' : 'Staff')

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="View notifications and alerts"
          title={
            unreadCount > 0
              ? `${unreadCount} unread pharmacy alerts for ${session?.user?.name || 'this login'}`
              : 'All notifications caught up'
          }
          className={cn(
            'relative h-8.5 w-8.5 rounded-lg border-border/70 transition-all duration-200',
            unreadCount > 0 && 'border-teal-500/50 bg-teal-500/5 hover:bg-teal-500/15'
          )}
        >
          <Bell
            className={cn(
              'h-4 w-4 transition-colors',
              unreadCount > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'
            )}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[420px] p-0 shadow-2xl border-border/80 bg-card/95 backdrop-blur-md rounded-xl overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-foreground">Notifications & Alerts</span>
                {unreadCount > 0 ? (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30">
                    {unreadCount} New
                  </Badge>
                ) : (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    Caught Up
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchNotifications()}
              disabled={loading}
              title="Refresh alerts"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
                className="h-7 px-2 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-500/10 dark:text-teal-400"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-b border-border/50 bg-background/50 px-3 pt-2">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="grid grid-cols-4 h-8 bg-muted/60 p-0.5 rounded-lg text-xs">
              <TabsTrigger value="all" className="text-[11px] font-medium data-[state=active]:bg-background">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-[11px] font-medium data-[state=active]:bg-background">
                Unread ({unreadCount})
              </TabsTrigger>
              <TabsTrigger value="stock" className="text-[11px] font-medium data-[state=active]:bg-background">
                Inventory
              </TabsTrigger>
              <TabsTrigger value="dues" className="text-[11px] font-medium data-[state=active]:bg-background">
                Dues/Rx
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Notification List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 select-none">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2.5">
                <Check className="h-6 w-6 stroke-[2.5]" />
              </div>
              <p className="font-semibold text-sm text-foreground">All Clear!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                {activeTab === 'unread'
                  ? 'No unread alerts. You are completely caught up on your pharmacy tasks.'
                  : 'No alerts match this filter.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(item => {
              const visual = getItemVisuals(item.type)
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer text-left',
                    !item.isRead
                      ? 'bg-teal-500/[0.04] hover:bg-teal-500/[0.08]'
                      : 'hover:bg-muted/40 opacity-80 hover:opacity-100'
                  )}
                >
                  {/* Category Icon Badge */}
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      visual.bg
                    )}
                  >
                    {visual.icon}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn('font-semibold text-xs truncate', !item.isRead ? 'text-foreground font-bold' : 'text-foreground/80')}>
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/80">
                      <span>{formatTimeAgo(item.createdAt)}</span>
                      <span>•</span>
                      <span className="font-medium text-foreground/70">{visual.badgeText}</span>
                      {item.data?.link && (
                        <span className="inline-flex items-center gap-0.5 text-teal-600 dark:text-teal-400 font-medium group-hover:underline">
                          View details <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={e => handleMarkAsRead(item.id, e)}
                        title="Mark read"
                        className="h-6 w-6 text-muted-foreground hover:text-teal-600"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => handleDelete(item.id, e)}
                      title="Dismiss notification"
                      className="h-6 w-6 text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Identity & Sync Status */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate max-w-[250px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">
              Synced to <strong>{session?.user?.name || 'Current User'}</strong> ({roleName})
            </span>
          </div>

          {notifications.some(n => n.isRead) && (
            <button
              onClick={handleClearRead}
              className="text-muted-foreground hover:text-foreground font-medium hover:underline shrink-0"
            >
              Clear read
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

import { useEffect, useRef, useCallback } from 'react';

export type SyncEventType =
  | 'APPLICATION_CREATED'
  | 'APPLICATION_UPDATED'
  | 'FEE_ASSESSED'
  | 'PAYMENT_RECONCILED'
  | 'SLOT_SCHEDULED'
  | 'SESSION_CREATED'
  | 'SESSION_UPDATED'
  | 'CERTIFICATE_ISSUED'
  | 'CERTIFICATE_UPDATED'
  | 'REFRESH_ALL';

export interface SyncMessage {
  type: SyncEventType;
  tenantId?: string;
  id?: string;
  timestamp: number;
}

// Global broadcast channel instance for zero-latency cross-tab synchronization
let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('emetrology_realtime_sync');
  }
} catch {
  // BroadcastChannel unavailable in older environments
}

/**
 * Broadcasts a state change event to all other open tabs/windows on the device.
 */
export function broadcastSyncEvent(type: SyncEventType, metadata?: { tenantId?: string; id?: string }) {
  if (channel) {
    try {
      channel.postMessage({
        type,
        tenantId: metadata?.tenantId,
        id: metadata?.id,
        timestamp: Date.now(),
      } as SyncMessage);
    } catch {
      // Ignore broadcast post errors
    }
  }
}

interface UseRealtimeSyncOptions {
  onSync: () => void | Promise<void>;
  pollIntervalMs?: number; // Defaults to 15000ms (15s)
  enabled?: boolean;
}

/**
 * Hook that orchestrates:
 * 1. Instant cross-tab BroadcastChannel event triggers
 * 2. Window focus & visibility revalidation (fetches fresh data the instant you switch to or click on the tab)
 * 3. Gentle background heartbeat polling (only when the tab is actively visible)
 */
export function useRealtimeSync({
  onSync,
  pollIntervalMs = 15000,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const isExecutingRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (!enabled || isExecutingRef.current) return;
    try {
      isExecutingRef.current = true;
      await onSyncRef.current();
    } catch (e) {
      console.warn('[RealtimeSync] sync error:', e);
    } finally {
      isExecutingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Cross-tab BroadcastChannel listener
    const handleBroadcast = () => {
      triggerSync();
    };

    if (channel) {
      channel.addEventListener('message', handleBroadcast);
    }

    // 2. Window focus & visibility revalidation listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };

    const handleWindowFocus = () => {
      triggerSync();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Gentle periodic polling ONLY while tab is actively visible
    let pollTimer: any = null;
    if (pollIntervalMs > 0) {
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          triggerSync();
        }
      }, pollIntervalMs);
    }

    return () => {
      if (channel) {
        channel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [enabled, pollIntervalMs, triggerSync]);

  return { triggerSync, broadcast: broadcastSyncEvent };
}

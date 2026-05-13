import { useCallback, useEffect, useRef, useState } from 'react';
import { type Node, type Edge, type Viewport } from 'reactflow';
import { researchApi, type CanvasState } from '../services/researchApi';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline';

interface UseResearchSessionReturn {
  sessionId: string | null;
  saveStatus: SaveStatus;
  loadCanvas: () => Promise<CanvasState | null>;
  scheduleAutoSave: (nodes: Node[], edges: Edge[], viewport: Viewport) => void;
  createSession: (title?: string) => Promise<string>;
}

const DEBOUNCE_MS = 3000;
const OFFLINE_QUEUE_KEY = 'research_hub_offline_queue';

function getSessionFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

function setSessionInUrl(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', id);
  window.history.replaceState(null, '', url.toString());
}

export function useResearchSession(): UseResearchSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(getSessionFromUrl);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingState = useRef<CanvasState | null>(null);

  const flushSave = useCallback(async (id: string, state: CanvasState) => {
    setSaveStatus('saving');
    try {
      await researchApi.saveCanvas(id, state);
      setSaveStatus('saved');
      // Clear any queued offline state
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {
      setSaveStatus('offline');
      // Queue the state locally so nothing is lost
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify({ sessionId: id, state }));
    }
  }, []);

  // Attempt to sync queued offline save on mount
  useEffect(() => {
    const queued = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queued) return;
    try {
      const { sessionId: qid, state } = JSON.parse(queued) as { sessionId: string; state: CanvasState };
      researchApi.saveCanvas(qid, state).then(() => {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        setSaveStatus('saved');
      }).catch(() => {/* still offline, leave queued */});
    } catch {/* corrupt entry */
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  }, []);

  const scheduleAutoSave = useCallback((nodes: Node[], edges: Edge[], viewport: Viewport) => {
    if (!sessionId) return;
    const state: CanvasState = { nodes: nodes as object[], edges: edges as object[], viewport };
    pendingState.current = state;
    setSaveStatus('unsaved');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (pendingState.current) {
        flushSave(sessionId, pendingState.current);
      }
    }, DEBOUNCE_MS);
  }, [sessionId, flushSave]);

  const createSession = useCallback(async (title = 'Untitled Research'): Promise<string> => {
    const session = await researchApi.createSession(title);
    setSessionId(session.id);
    setSessionInUrl(session.id);
    setSaveStatus('saved');
    return session.id;
  }, []);

  const loadCanvas = useCallback(async (): Promise<CanvasState | null> => {
    if (!sessionId) return null;
    try {
      const result = await researchApi.getCanvas(sessionId);
      setSaveStatus('saved');
      return result.state;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('404')) {
        return null;
      }
      setSaveStatus('offline');
      return null;
    }
  }, [sessionId]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (pendingState.current && sessionId) {
        flushSave(sessionId, pendingState.current);
      }
    };
  }, [sessionId, flushSave]);

  return { sessionId, saveStatus, loadCanvas, scheduleAutoSave, createSession };
}

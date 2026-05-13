const AGENTS_URL = (import.meta.env.VITE_AGENTS_URL as string | undefined) ?? 'http://localhost:8002';
const RESEARCH_USER = (import.meta.env.VITE_RESEARCH_USER as string | undefined) ?? 'default';

const BASE = `${AGENTS_URL}/api/v1/research-hub`;

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Research-User': RESEARCH_USER,
});

export interface ResearchSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasState {
  nodes: object[];
  edges: object[];
  viewport: { x: number; y: number; zoom: number };
}

export interface CanvasResponse {
  session_id: string;
  state: CanvasState;
  updated_at: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const researchApi = {
  async createSession(title = 'Untitled Research'): Promise<ResearchSession> {
    const res = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title }),
    });
    return handleResponse<ResearchSession>(res);
  },

  async listSessions(): Promise<ResearchSession[]> {
    const res = await fetch(`${BASE}/sessions`, { headers: headers() });
    return handleResponse<ResearchSession[]>(res);
  },

  async getSession(id: string): Promise<ResearchSession> {
    const res = await fetch(`${BASE}/sessions/${id}`, { headers: headers() });
    return handleResponse<ResearchSession>(res);
  },

  async getCanvas(sessionId: string): Promise<CanvasResponse> {
    const res = await fetch(`${BASE}/sessions/${sessionId}/canvas`, { headers: headers() });
    return handleResponse<CanvasResponse>(res);
  },

  async saveCanvas(sessionId: string, state: CanvasState): Promise<CanvasResponse> {
    const res = await fetch(`${BASE}/sessions/${sessionId}/canvas`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ state }),
    });
    return handleResponse<CanvasResponse>(res);
  },
};

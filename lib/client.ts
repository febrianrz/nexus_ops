'use client';
import { create } from 'zustand';
import type { Workspace } from './types';
import type { TeamData } from './team-types';
interface AppStore extends Workspace {
  loaded: boolean;
  storage: string;
  workspaceId: string | null;
  selectedProjectId: string | null;
  selectProject: (id: string) => void;
  team: TeamData;
  refresh: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const workspaceId = useWorkspace.getState().workspaceId;
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'X-Nexus-Workspace': workspaceId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (response.status === 401 && typeof window !== 'undefined') {
    useWorkspace.setState({ actors: [], tasks: [], events: [], loaded: false });
    window.location.replace('/login');
  }
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
let refreshVersion = 0;
export const useWorkspace = create<AppStore>((set, get) => ({
  actors: [],
  tasks: [],
  events: [],
  projects: [],
  loaded: false,
  storage: 'postgresql',
  workspaceId: null,
  selectedProjectId: null,
  team: { workspaces: [], current: null, members: [], pending: [], invitations: [] },
  switchWorkspace: async (id) => {
    refreshVersion++;
    set({
      workspaceId: id,
      selectedProjectId: null,
      projects: [],
      actors: [],
      tasks: [],
      events: [],
      loaded: false,
    });
    await get().refresh();
  },
  refresh: async () => {
    const version = ++refreshVersion;
    const team = await api<TeamData>('/workspaces');
    if (version !== refreshVersion) return;
    if (team.current?.id !== get().workspaceId)
      set({
        actors: [],
        tasks: [],
        events: [],
        projects: [],
        selectedProjectId: null,
        loaded: false,
      });
    set({ team, workspaceId: team.current?.id ?? null });
    if (!team.current) {
      set({ loaded: true });
      return;
    }
    try {
      const data = await api<Workspace & { storage: string }>('/workspace');
      if (version === refreshVersion) {
        const selected = get().selectedProjectId;
        set({
          ...data,
          selectedProjectId: data.projects.some((project) => project.id === selected)
            ? selected
            : (data.projects[0]?.id ?? null),
          loaded: true,
        });
      }
    } catch (error) {
      if (version === refreshVersion)
        set({ actors: [], tasks: [], events: [], projects: [], loaded: false });
      throw error;
    }
  },
  selectProject: (id) => set({ selectedProjectId: id }),
}));

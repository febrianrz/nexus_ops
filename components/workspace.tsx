'use client';
import type { SessionUser } from '@/lib/auth-types';
import { api, useWorkspace } from '@/lib/client';
import type { Actor, Task, TaskState } from '@/lib/types';
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'framer-motion';
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Flag,
  Layers,
  Check,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Circle,
  CircleDot,
  FileCode2,
  Filter,
  FolderKanban,
  GitBranch,
  GitPullRequest,
  Globe,
  HelpCircle,
  Keyboard,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  LoaderCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Plus,
  ListPlus,
  Radio,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Terminal,
  Ticket,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast, Toaster } from 'sonner';
import { WorkspacePicker, WorkspaceTeam } from './workspace-team';
import Inspector from './inspector';
import TaskCard from './task-card';
import { Avatar, Button, EmptyState, IconButton, Modal, PriorityIcon } from './ui';
import { CreateTask, IntegrationSetup } from './workspace-forms';
import ProjectManager from './project-manager';
import AgentSettings from './agent-settings';
import { AssigneePicker } from './assignee-picker';
import DeveloperSettings from './developer-settings';
import ProfileSettings from './profile-settings';
import { TaskPlanningCell } from './task-planning';
import { Notifications } from './notifications';
import { PriorityPicker } from './priority-picker';
import { SortableTaskRow, TaskOrderProvider } from './task-order';
import { priorityLabel } from '@/lib/task-priority';
const columns: { state: TaskState; label: string; className: string; icon: typeof Circle }[] = [
  { state: 'TRIAGE', label: 'Todo', className: 'triage', icon: CircleDot },
  { state: 'EXECUTING', label: 'Progress', className: 'executing', icon: LoaderCircle },
  { state: 'WAITING_HUMAN', label: 'Testing', className: 'review', icon: CircleDot },
  { state: 'DONE', label: 'Done', className: 'done', icon: CheckCheck },
];
const taskStatuses: { label: string; state: TaskState; color: string }[] = [
  { label: 'Todo', state: 'TRIAGE', color: 'todo' },
  { label: 'Progress', state: 'EXECUTING', color: 'progress' },
  { label: 'Testing', state: 'WAITING_HUMAN', color: 'review' },
  { label: 'Done', state: 'DONE', color: 'done' },
];
const taskStatusIndex = (state: TaskState) => state === 'QUEUED' ? 0 : state === 'BLOCKED' ? 2 : Math.max(0, taskStatuses.findIndex((item) => item.state === state));
const filters = ['All tasks', 'My approvals', 'Agent tasks', 'GitHub PRs'];
type ModalKind =
  | 'task'
  | 'help'
  | 'integrations'
  | 'workspace-settings'
  | 'members-settings'
  | 'agents'
  | 'developer'
  | 'profile'
  | 'workspaces'
  | 'projects'
  | null;

function renderProjectTaskTree(
  tasks: Task[],
  depth: number,
  childrenByParent: Map<string, Task[]>,
  expandedTaskIds: string[],
  onToggle: (taskId: string) => void,
  onSelect: (taskId: string) => void,
): ReactElement[] {
  return tasks.map((task) => {
    const children = childrenByParent.get(task.id) ?? [];
    const expanded = expandedTaskIds.includes(task.id);
    return (
      <div className="project-task-branch" key={task.id}>
        <div className="project-task-row" style={{ '--task-depth': depth } as CSSProperties}>
          <button
            className="project-task-link"
            onClick={() => (children.length ? onToggle(task.id) : onSelect(task.id))}
            title={task.title}
            aria-expanded={children.length ? expanded : undefined}
          >
            <span>{task.title}</span>
          </button>
          {children.length > 0 && (
            <button
              className={`project-task-expand ${expanded ? 'expanded' : ''}`}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} subtasks for ${task.title}`}
              aria-expanded={expanded}
              onClick={() => onToggle(task.id)}
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {expanded && children.length > 0 && (
            <motion.div
              className="project-task-children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderProjectTaskTree(children, depth + 1, childrenByParent, expandedTaskIds, onToggle, onSelect)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  });
}

function renderProjectTableRows(
  tasks: Task[],
  depth: number,
  childrenByParent: Map<string, Task[]>,
  expandedTaskIds: string[],
  actors: Actor[],
  onToggle: (taskId: string) => void,
  onSelect: (taskId: string) => void,
  onAddSubtask: (taskId: string) => void,
  onStatusClick: (task: Task, bounds: DOMRect) => void,
): ReactElement[] {
  return tasks.map((task) => {
    const children = childrenByParent.get(task.id) ?? [];
    const expanded = expandedTaskIds.includes(task.id);
    const phase = typeof task.context_payload.phase === 'string' ? task.context_payload.phase : null;
    return (
      <div className="project-table-branch" key={task.id}>
        <SortableTaskRow task={task}>
          <div className="project-table-name" style={{ '--task-depth': depth } as CSSProperties}>
            {children.length > 0 ? (
              <button
                className={`project-table-expand ${expanded ? 'expanded' : ''}`}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} subtasks for ${task.title}`}
                aria-expanded={expanded}
                onClick={() => onToggle(task.id)}
              >
                <ChevronRight size={13} />
              </button>
            ) : (
              <span className="project-table-expander-space" />
            )}
            <button data-status-picker className={`project-row-status status-${task.state.toLowerCase()}`} aria-label={`Change status for ${task.title}: ${taskStatuses[taskStatusIndex(task.state)].label}`} aria-haspopup="menu" onClick={(event) => onStatusClick(task, event.currentTarget.getBoundingClientRect())}>
              {task.state === 'DONE' ? <Check size={12} /> : task.state === 'TRIAGE' || task.state === 'QUEUED' ? null : <CircleDot size={14} />}
            </button>
            <button className="project-table-task" onClick={() => onSelect(task.id)} title={`${task.id}: ${task.title}`}>
              <strong>{task.title}</strong>
            </button>
            {children.length > 0 && <button className="project-child-count" onClick={() => onToggle(task.id)} aria-label={`${children.length} subtasks for ${task.title}`}><GitBranch size={12} />{children.length}</button>}
            {task.is_agent_task && <span title={`Agent: ${task.agent_key}`}><Bot size={13} /></span>}
          </div>
          <AssigneePicker task={task} />
          <PriorityPicker task={task} />
          <TaskPlanningCell task={task} field="due_date" />
          <TaskPlanningCell task={task} field="start_date" />
          <span className="project-table-phase">{phase ? <span>{phase}</span> : '–'}</span>
          <TaskPlanningCell task={task} field="completion" />
          {depth < 2 ? (
            <button className="project-row-add" aria-label={`Add ${depth === 1 ? 'sub-subtask' : 'subtask'} to ${task.title}`} onClick={() => onAddSubtask(task.id)}><Plus size={14} /></button>
          ) : <span />}
        </SortableTaskRow>
        <AnimatePresence initial={false}>
          {expanded && children.length > 0 && (
            <motion.div
              className="project-table-children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderProjectTableRows(children, depth + 1, childrenByParent, expandedTaskIds, actors, onToggle, onSelect, onAddSubtask, onStatusClick)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  });
}

export default function Workspace({ user }: { user: SessionUser }) {
  const {
    tasks: allTasks,
    actors,
    events: allEvents,
    refresh,
    loaded,
    storage,
    team,
    switchWorkspace,
    projects,
    selectedProjectId,
    selectProject,
  } = useWorkspace();
  const [view, setView] = useState('overview');
  const [filter, setFilter] = useState('All tasks');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [subtaskParent, setSubtaskParent] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [layout, setLayout] = useState('board');
  const [sidebar, setSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(216);
  const resizingSidebar = useRef(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedProjectTaskIds, setExpandedProjectTaskIds] = useState<string[]>([]);
  const [collapsedProjectGroups, setCollapsedProjectGroups] = useState<string[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState('ALL');
  const [filterMenu, setFilterMenu] = useState(false);
  const [displayMenu, setDisplayMenu] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const collapsed = localStorage.getItem('nexus-sidebar-collapsed');
    const width = Number(localStorage.getItem('nexus-sidebar-width'));
    if (collapsed === 'true') setSidebarCollapsed(true);
    if (Number.isFinite(width) && width >= 180 && width <= 360) setSidebarWidth(width);
  }, []);
  useEffect(() => {
    localStorage.setItem('nexus-sidebar-collapsed', String(sidebarCollapsed));
    localStorage.setItem('nexus-sidebar-width', String(sidebarWidth));
  }, [sidebarCollapsed, sidebarWidth]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!resizingSidebar.current) return;
      setSidebarWidth(Math.max(180, Math.min(360, event.clientX)));
    };
    const stop = () => { resizingSidebar.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, []);
  async function selectWorkspace(id: string) {
    setSelected(null);
    setQuery('');
    setFilter('All tasks');
    setView('overview');
    setSidebar(false);
    await switchWorkspace(id);
    localStorage.setItem(`nexus-workspace:${user.id}`, id);
    setModal(null);
    setError('');
  }
  const currentActor = actors.find((actor) => actor.id === user.actorId);
  const project = projects.find((item) => item.id === selectedProjectId) ?? projects[0];
  const tasks = allTasks.filter((task) => task.project_id === project?.id);
  const summaryTasks = allTasks;
  const globalCompletion = summaryTasks.length
    ? Math.round((summaryTasks.filter((task) => task.state === 'DONE').length / summaryTasks.length) * 100)
    : 0;
  const projectTaskIds = new Set(tasks.map((task) => task.id));
  const events = allEvents.filter((event) => projectTaskIds.has(event.task_id));
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      useWorkspace.setState({ actors: [], tasks: [], events: [], loaded: false });
      sessionStorage.removeItem('nexus-token');
      window.location.replace('/login');
    } catch (error) {
      toast.error((error as Error).message);
      setLoggingOut(false);
    }
  }
  useEffect(() => {
    const savedWorkspace = localStorage.getItem(`nexus-workspace:${user.id}`);
    if (savedWorkspace) useWorkspace.setState({ workspaceId: savedWorkspace });
    const sync = () =>
      refresh()
        .then(() => setError(''))
        .catch((e) => setError(e.message));
    sync();
    const id = setInterval(sync, 10000);
    const task = new URLSearchParams(location.search).get('task');
    if (task) setSelected(task);
    const saved = localStorage.getItem('nexus-theme');
    if (saved) {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    if (!team.current?.id || !projects.length) return;
    const key = `nexus-project:${team.current.id}`;
    const saved = localStorage.getItem(key);
    const next = projects.find((item) => item.id === saved)?.id ?? projects[0].id;
    if (next !== selectedProjectId) selectProject(next);
  }, [team.current?.id, projects, selectedProjectId, selectProject]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [profileMenuOpen]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setModal(null);
        setFilterMenu(false);
        setDisplayMenu(false);
        setProfileMenuOpen(false);
        setStatusMenu(null);
      }
      if (!editing && e.key === 'n' && project) setModal('task');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [project]);
  useEffect(() => {
    if (!statusMenu) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-status-picker]')) setStatusMenu(null);
    };
    const closeOnScroll = () => setStatusMenu(null);
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('scroll', closeOnScroll, true); };
  }, [statusMenu]);
  async function updateTaskStatus(taskId: string, state: TaskState) {
    if (statusSaving) return;
    setStatusSaving(true);
    try {
      await api(`/tasks/${taskId}`, 'PATCH', { action: 'set-status', state });
      await refresh();
    } catch (error) { toast.error((error as Error).message); }
    finally { setStatusSaving(false); }
  }
  const selectedTask = tasks.find((t) => t.id === selected);
  const review = tasks.filter((t) => t.state === 'WAITING_HUMAN');
  const running = tasks.filter((t) => t.state === 'EXECUTING');
  const completed = tasks.filter((t) => t.state === 'DONE');
  const filtered = useMemo(() => {
    let result = tasks.filter(
      (t) =>
        (view !== 'agent-tasks' || t.is_agent_task) &&
        (!query ||
          `${t.title} ${t.id} ${t.labels.join(' ')}`.toLowerCase().includes(query.toLowerCase())) &&
        (priority === 'ALL' || t.priority === priority) &&
        (filter === 'All tasks' ||
          (filter === 'My approvals' && t.state === 'WAITING_HUMAN') ||
          (filter === 'Agent tasks' && t.is_agent_task) ||
          (filter === 'GitHub PRs' && t.source_type === 'GITHUB_PR')),
    );
    if (sort) result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [tasks, query, priority, filter, sort, view]);
  const closeInspector = useCallback(() => setSelected(null), []);
  function navigate(v: string) {
    setView(v);
    setSidebar(false);
    setFilter('All tasks');
  }
  function openProject(id: string) {
    selectProject(id);
    if (team.current?.id) localStorage.setItem(`nexus-project:${team.current.id}`, id);
    setView('project');
    setFilter('All tasks');
    setSelected(null);
    setSidebar(false);
  }
  async function action(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (success) toast.success(success);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approve(task: Task) {
    await action(
      () => api(`/tasks/${task.id}`, 'PATCH', { action: 'approve' }),
      'Task approved and completed.',
    );
  }
  function changeTheme(next: string) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('nexus-theme', next);
  }
  const navItem = (id: string, label: string, Icon: typeof Activity, count?: number) => (
    <button
      className={`nav-item ${view === id ? 'active' : ''}`}
      onClick={() => navigate(id)}
      key={id}
      title={sidebarCollapsed ? label : undefined}
    >
      <Icon size={17} />
      <span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
      {view === id && <span className="nav-active-dot" />}
    </button>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell" style={{ '--sidebar-width': `${sidebarCollapsed ? 68 : sidebarWidth}px` } as CSSProperties}>
        <Toaster
          position="bottom-right"
          theme={theme === 'dark' ? 'dark' : 'light'}
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: 'inherit' } }}
        />
        {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)} />}
        <aside className={`sidebar ${sidebar ? 'mobile-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <a className="brand" href="/" aria-label="NexusOps home">
            <NexusLogo />
            <span>
              Nexus<span className="brand-ops">Ops</span>
            </span>
            <span className="brand-dot" />
          </a>
          <button className="sidebar-collapse-button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
          </button>
          <button className="workspace-switcher" title={sidebarCollapsed ? 'Choose workspace' : undefined} onClick={() => setModal('workspaces')}>
            <span className="workspace-symbol">N</span>
            <span>
              <strong>{team.current?.name ?? 'Choose workspace'}</strong>
              <small>
                {team.current?.role === 'admin' ? 'Admin' : 'Member'}
                {team.invitations.length > 0
                  ? ` · ${team.invitations.length} invitation${team.invitations.length > 1 ? 's' : ''}`
                  : ''}
              </small>
            </span>
            <ChevronsUpDown size={13} />
          </button>
          <button className="sidebar-search" title={sidebarCollapsed ? 'Quick search' : undefined} onClick={() => setCommandOpen(true)}>
            <Search size={15} />
            <span>Quick search</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {navItem('overview', 'Overview', LayoutDashboard)}
            {navItem('my-tasks', 'My approvals', CheckCheck, review.length)}
            {navItem(
              'agent-tasks',
              'Agent queue',
              Bot,
              tasks.filter((task) => task.is_agent_task && task.state !== 'DONE').length,
            )}
            {navItem('activity', 'Activity', Activity)}
          </nav>
          <div className="sidebar-projects">
            <div className="sidebar-projects-heading">
              <button
                className="sidebar-projects-toggle"
                aria-expanded={!projectsCollapsed}
                onClick={() => setProjectsCollapsed((value) => !value)}
              >
                {projectsCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <span className="nav-caption">PROJECTS</span>
              </button>
              <IconButton label="Add project" onClick={() => setModal('projects')}>
                <Plus size={14} />
              </IconButton>
            </div>
            {!projectsCollapsed && (
              <div className="sidebar-project-list">
                {projects.map((item) => {
                  const projectTasks = allTasks.filter((task) => task.project_id === item.id);
                  const roots = projectTasks.filter((task) => !task.parent_task_id);
                  const childrenByParent = new Map<string, Task[]>();
                  projectTasks.forEach((task) => {
                    if (!task.parent_task_id) return;
                    const siblings = childrenByParent.get(task.parent_task_id) ?? [];
                    siblings.push(task);
                    childrenByParent.set(task.parent_task_id, siblings);
                  });
                  const count = projectTasks.length;
                  return (
                    <div key={item.id} className="project-nav-item-wrap">
                      <div className="project-nav-row">
                      <button
                        className={`nav-item project-nav-item ${item.id === project?.id ? 'active' : ''}`}
                        onClick={() => {
                          openProject(item.id);
                          setExpandedProjectId((expanded) =>
                            expanded === item.id ? null : item.id,
                          );
                        }}
                        title={item.name}
                        aria-expanded={expandedProjectId === item.id}
                      >
                        <FolderKanban size={16} />
                        <span>{item.name}</span>
                        <span className="nav-count">{count}</span>
                        {item.id === project?.id && <span className="nav-active-dot" />}
                      </button>
                      <IconButton
                        label={`Add task to ${item.name}`}
                        onClick={() => {
                          openProject(item.id);
                          setModal('task');
                        }}
                      >
                        <ListPlus size={14} />
                      </IconButton>
                      </div>
                      <AnimatePresence initial={false}>
                        {expandedProjectId === item.id && (
                          <motion.div
                            className="project-task-submenu"
                            initial={{ height: 0, opacity: 0, y: -5 }}
                            animate={{ height: 'auto', opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -5 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {roots.length ? (
                              <div className="project-task-tree">
                                {renderProjectTaskTree(roots, 0, childrenByParent, expandedProjectTaskIds, (taskId) => {
                                  setExpandedProjectTaskIds((expanded) =>
                                    expanded.includes(taskId)
                                      ? expanded.filter((id) => id !== taskId)
                                      : [...expanded, taskId],
                                  );
                                }, (taskId) => {
                                  openProject(item.id);
                                  setSelected(taskId);
                                })}
                              </div>
                            ) : (
                              <p className="project-task-submenu-empty">No tasks yet</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {!projects.length && <p className="sidebar-project-empty">No projects yet</p>}
              </div>
            )}
          </div>
          {!sidebarCollapsed && <div className="sidebar-resize-handle" role="separator" aria-label="Resize sidebar" onPointerDown={(event) => { event.preventDefault(); resizingSidebar.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }} />}
        </aside>
        <main className={`main-workspace ${view === 'project' ? 'project-view' : ''}`}>
          <header className="topbar">
            <div className="breadcrumbs">
              <IconButton
                label="Toggle sidebar"
                className="mobile-menu"
                onClick={() => setSidebar((v) => !v)}
              >
                <Menu size={18} />
              </IconButton>
              <span className="breadcrumb-icon">
                <LayoutGrid size={14} />
              </span>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>
                {view === 'overview'
                  ? 'Overview'
                  : view === 'project'
                    ? (project?.name ?? 'Project')
                  : view === 'my-tasks'
                    ? 'My approvals'
                    : view === 'agent-tasks'
                      ? 'Agent queue'
                      : view === 'activity'
                        ? 'Activity'
                        : 'Integrations'}
              </strong>
            </div>
            <div className="topbar-actions">
              <span className="connection-status">
                <i className="breathing-dot" />
                All systems operational
              </span>
              <span className="topbar-divider" />
              <IconButton label="Search workspace" onClick={() => setCommandOpen(true)}>
                <Search size={17} />
              </IconButton>
              <Notifications onOpenTask={(task) => {
                if (task.project_id) {
                  openProject(task.project_id);
                  setExpandedProjectId(task.project_id);
                  setSelected(task.id);
                }
              }} onOpenInvitations={() => setModal('workspaces')} />
            <div className="profile-menu-wrap topbar-profile" ref={profileMenuRef}>
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    className="profile-menu"
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="account-menu-identity"><strong>{user.name}</strong><small>{user.email}</small></div>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('workspace-settings'); }}>
                      <Settings2 size={15} />
                      <span>Workspace settings</span>
                    </button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('integrations'); }}>
                      <GitBranch size={15} />
                      <span>Integrations</span>
                    </button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('members-settings'); }}>
                      <Users size={15} />
                      <span>Members &amp; settings</span>
                    </button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('agents'); }}><Bot size={15} /><span>AI agents</span></button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('developer'); }}><KeyRound size={15} /><span>Developer</span></button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('profile'); }}><Users size={15} /><span>Profile</span></button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setModal('help'); }}><HelpCircle size={15} /><span>Help &amp; shortcuts</span></button>
                    <div className="profile-menu-divider" />
                    <button role="menuitem" onClick={() => void logout()} disabled={loggingOut}>
                      <LogOut size={15} />
                      <span>{loggingOut ? 'Signing out…' : 'Log out'}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                className="profile topbar-profile-trigger"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <Avatar actor={currentActor} size={33} active />
                <ChevronsUpDown size={14} />
              </button>
            </div>
            </div>
          </header>
          <div className="page-content">
            {view !== 'project' && <div className="page-heading">
              <div>
                <div className="heading-title">
                  <h1>
                    {view === 'project'
                      ? (project?.name ?? 'Project tasks')
                      : view === 'agent-tasks'
                      ? 'Work ready for external workers.'
                      : view === 'activity'
                        ? 'Every move, in the open.'
                        : view === 'integrations'
                          ? 'Bring your work together.'
                          : view === 'my-tasks'
                            ? 'Your judgment. Their momentum.'
                          : 'Workspace overview.'}
                  </h1>
                  <span className="workspace-badge">
                    <span />
                    LIVE WORKSPACE
                  </span>
                </div>
                <p>
                  {view === 'project'
                    ? 'Tasks and subtasks in this project.'
                    : view === 'agent-tasks'
                    ? 'Tasks are claimed by third-party workers using their agent key.'
                    : view === 'activity'
                      ? 'One timeline of people and external workers moving work forward.'
                      : view === 'integrations'
                        ? 'Turn issues, pull requests, and support tickets into coordinated action.'
                        : view === 'my-tasks'
                          ? 'A little human oversight goes a long way. Here’s what needs your attention.'
                          : 'A global summary of every project and task.'}
                </p>
              </div>
              <Button
                className="primary new-task"
                onClick={() => setModal('task')}
                disabled={!project}
                title={!project ? 'Create a project before adding tasks' : undefined}
              >
                <Plus size={16} />
                Create task
                <kbd>N</kbd>
              </Button>
            </div>}
            {error && (
              <div className="error-banner">
                <ShieldAlert size={16} />
                {error}
                <Button
                  onClick={() =>
                    refresh()
                      .then(() => setError(''))
                      .catch((e) => setError(e.message))
                  }
                >
                  Retry
                </Button>
              </div>
            )}
            {view === 'project' && (
              <TaskOrderProvider><section className="project-work-list" aria-label={`${project?.name ?? 'Project'} tasks`}>
                <div className="project-view-tabs">
                  <button className="active"><List size={14} />List</button>
                  <button onClick={() => { setLayout('board'); setView('overview'); }}><LayoutGrid size={14} />Board</button>
                  <button onClick={() => navigate('activity')}><Activity size={14} />Activity</button>
                </div>
                <div className="project-list-toolbar">
                  <span className="project-grouping"><Layers size={13} />Status</span>
                  <div className="project-list-actions">
                    <Button onClick={() => setCommandOpen(true)} aria-label="Search tasks"><Search size={16} /></Button>
                    <Button onClick={() => setModal('workspace-settings')} aria-label="Workspace settings"><Settings2 size={15} /></Button>
                    <Button className="project-create-task" onClick={() => setModal('task')} disabled={!project}><Plus size={14} />Task</Button>
                  </div>
                </div>
                {project ? (
                  <div className="project-groups">
                    {[
                      { label: 'Todo', states: ['TRIAGE', 'QUEUED'], color: 'todo' },
                      { label: 'Progress', states: ['EXECUTING'], color: 'progress' },
                      { label: 'Testing', states: ['WAITING_HUMAN', 'BLOCKED'], color: 'review' },
                      { label: 'Done', states: ['DONE'], color: 'done' },
                    ].map((group) => {
                      const roots = tasks.filter(
                        (task) => !task.parent_task_id && group.states.includes(task.state),
                      );
                      const childrenByParent = new Map<string, Task[]>();
                      tasks.forEach((task) => {
                        if (!task.parent_task_id) return;
                        const children = childrenByParent.get(task.parent_task_id) ?? [];
                        children.push(task);
                        childrenByParent.set(task.parent_task_id, children);
                      });
                      const countTree = (task: Task): number =>
                        1 + (childrenByParent.get(task.id) ?? []).reduce((sum, child) => sum + countTree(child), 0);
                      const count = roots.reduce((sum, task) => sum + countTree(task), 0);
                      if (!count) return null;
                      const expanded = !collapsedProjectGroups.includes(group.label);
                      return (
                        <section className="project-status-group" key={group.label}>
                          <button
                            className="project-status-heading"
                            aria-expanded={expanded}
                            onClick={() => setCollapsedProjectGroups((groups) =>
                              groups.includes(group.label)
                                ? groups.filter((label) => label !== group.label)
                                : [...groups, group.label],
                            )}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span className={`project-status-pill ${group.color}`}><CircleDot size={13} />{group.label}</span>
                            <span className="project-status-count">{count}</span>
                          </button>
                          {expanded && <div className="project-table-wrap">
                            <div className="project-table-header">
                              <span>Name</span>
                              <span>Assignee</span>
                              <span>Priority</span>
                              <span>Due date</span>
                              <span>Start date</span>
                              <span>Phases</span>
                              <span>Completion</span>
                              <span />
                            </div>
                            {roots.length ? (
                              <div className="project-table-body">
                                {renderProjectTableRows(
                                  roots,
                                  0,
                                  childrenByParent,
                                  expandedProjectTaskIds,
                                  actors,
                                  (taskId) => setExpandedProjectTaskIds((expanded) =>
                                    expanded.includes(taskId)
                                      ? expanded.filter((id) => id !== taskId)
                                      : [...expanded, taskId],
                                  ),
                                  (taskId) => setSelected(taskId),
                                  (taskId) => setSubtaskParent(taskId),
                                  (task, bounds) => {
                                    if (statusSaving) return;
                                    setStatusMenu({ taskId: task.id, x: Math.min(bounds.left, window.innerWidth - 190), y: Math.min(bounds.bottom + 7, window.innerHeight - 220) });
                                    const next = taskStatuses[Math.min(taskStatusIndex(task.state) + 1, taskStatuses.length - 1)].state;
                                    if (next !== task.state) void updateTaskStatus(task.id, next);
                                  },
                                )}
                              </div>
                            ) : (
                              <p className="project-table-empty">No tasks in this group</p>
                            )}
                            <button className="project-group-add" onClick={() => setModal('task')}><Plus size={14} />Add Task</button>
                          </div>}
                        </section>
                      );
                    })}
                    {!tasks.length && (
                      <EmptyState title="No tasks yet" description="Create a task to start this project." />
                    )}
                  </div>
                ) : (
                  <EmptyState title="Select a project" description="Choose a project from the sidebar." />
                )}
              </section></TaskOrderProvider>
            )}
            {(view === 'overview' || view === 'my-tasks' || view === 'agent-tasks') && (
              <>
                <section className="overview-stats" aria-label="Workspace summary">
                  <div className="stat">
                    <div className="stat-label">
                      <LayersIcon />
                      Tasks in motion
                    </div>
                    <div className="stat-value">
                      {String(summaryTasks.filter((t) => t.state !== 'DONE').length).padStart(2, '0')}
                      <span className="stat-change">
                        <span className="little-dot" />
                        Across all projects
                      </span>
                    </div>
                    <div className="stat-track">
                      {['TRIAGE', 'QUEUED', 'EXECUTING', 'WAITING_HUMAN', 'DONE']
                        .filter((state) => summaryTasks.some((task) => task.state === state))
                        .map((s) => (
                          <span
                            key={s}
                            className={`track-${s.toLowerCase()}`}
                            style={{
                              flex: summaryTasks.filter((t) => t.state === s).length,
                            }}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">
                      <Bot size={15} />
                      Agent tasks
                    </div>
                    <div className="stat-value">
                      {String(
                        summaryTasks.filter((task) => task.is_agent_task && task.state !== 'DONE').length,
                      ).padStart(2, '0')}
                    </div>
                    <p>
                      <span className="status-dot executing" />
                      Flagged for external workers
                    </p>
                  </div>
                  <button
                    className="stat stat-clickable"
                    onClick={() => {
                      setFilter('My approvals');
                      setView('overview');
                    }}
                  >
                    <div className="stat-label">
                      <UserReviewIcon />
                      Needs your eyes
                    </div>
                    <div className="stat-value amber-text">
                      {String(summaryTasks.filter((task) => task.state === 'WAITING_HUMAN' || task.state === 'BLOCKED').length).padStart(2, '0')}
                      <span className="approval-stat-label">
                        Human review
                        <ArrowUpRight size={12} />
                      </span>
                    </div>
                    <p>A final check. A confident ship.</p>
                  </button>
                  <div className="stat guardrail-stat">
                    <div className="stat-label"><FolderKanban size={15} /> Projects</div>
                    <div className="guardrail-title"><span className="guardrail-icon"><FolderKanban size={20} /></span><strong>{projects.length}</strong></div>
                    <p>Projects in this workspace.</p>
                  </div>
                </section>
                {view === 'overview' && (
                  <section className="overview-projects" aria-label="Project summary">
                    <div className="overview-projects-heading">
                      <div><h2>Projects</h2><p>Completion across every project.</p></div>
                      <strong>{globalCompletion}% overall</strong>
                    </div>
                    <div className="overview-project-grid">
                      {projects.map((item) => {
                        const projectTasks = summaryTasks.filter((task) => task.project_id === item.id);
                        const completed = projectTasks.filter((task) => task.state === 'DONE').length;
                        const completion = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
                        return (
                          <button className="overview-project-card" key={item.id} onClick={() => { selectProject(item.id); setView('project'); }}>
                            <div className="overview-project-card-top"><span className="project-pulse-mark">{item.name.slice(0, 1).toUpperCase()}</span><span>{item.name}</span><strong>{completion}%</strong></div>
                            <div className="overview-project-progress"><span style={{ width: `${completion}%` }} /></div>
                            <div className="overview-project-meta"><span>{projectTasks.length} task{projectTasks.length === 1 ? '' : 's'}</span><span>{completed} done</span></div>
                          </button>
                        );
                      })}
                      {!projects.length && <EmptyState title="No projects yet" description="Create a project to see its summary here." />}
                    </div>
                  </section>
                )}
                {view !== 'overview' && <>
                <div className="workspace-tabs">
                  <div>
                    <button
                      className="active"
                      onClick={() => {
                        setFilter('All tasks');
                        setView('overview');
                      }}
                    >
                      <LayoutGrid size={15} />
                      Task board<span>{tasks.length}</span>
                    </button>
                    <button
                      onClick={() => navigate('agent-tasks')}
                      className={view === 'agent-tasks' ? 'active' : ''}
                    >
                      <Bot size={16} />
                      Agent queue
                      <span>
                        {tasks.filter((task) => task.is_agent_task && task.state !== 'DONE').length}
                      </span>
                    </button>
                    <button onClick={() => navigate('activity')}>
                      <Activity size={15} />
                      Activity
                    </button>
                  </div>
                  <span className="demo-label">
                    <span className="little-dot" />
                    {storage === 'local-demo' ? 'Demo workspace' : 'Connected to PostgreSQL'}
                  </span>
                </div>
                <div className="board-toolbar">
                  <div className="filter-pills">
                    {filters.map((f) => (
                      <button
                        key={f}
                        className={
                          filter === f || (view === 'my-tasks' && f === 'My approvals')
                            ? 'selected'
                            : ''
                        }
                        onClick={() => {
                          setFilter(f);
                          if (view === 'my-tasks') setView('overview');
                        }}
                      >
                        {f === 'My approvals' && <CheckCheck size={13} />} {f}
                        {f === 'My approvals' && <span>{review.length}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="board-tools">
                    <div className="toolbar-search">
                      <Search size={14} />
                      <input
                        aria-label="Search tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tasks…"
                      />
                      <kbd>/</kbd>
                    </div>
                    <div className="popover-anchor">
                      <Button
                        className={`toolbar-button ${priority !== 'ALL' ? 'is-filtered' : ''}`}
                        onClick={() => {
                          setFilterMenu((v) => !v);
                          setDisplayMenu(false);
                        }}
                      >
                        <Filter size={14} />
                        <span>Filter</span>
                        {priority !== 'ALL' && <i />}
                      </Button>
                      {filterMenu && (
                        <div className="small-popover">
                          <span className="popover-label">PRIORITY</span>
                          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setPriority(p);
                                setFilterMenu(false);
                              }}
                            >
                              {p === 'ALL' ? (
                                <Circle size={13} />
                              ) : (
                                <PriorityIcon priority={p as Task['priority']} />
                              )}
                              <span>{p === 'ALL' ? 'All priorities' : priorityLabel(p as Task['priority'])}</span>
                              {priority === p && <Check size={13} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="view-toggle">
                      <button
                        title="Board view"
                        aria-label="Board view"
                        className={layout === 'board' ? 'active' : ''}
                        onClick={() => setLayout('board')}
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        title="List view"
                        aria-label="List view"
                        className={layout === 'list' ? 'active' : ''}
                        onClick={() => setLayout('list')}
                      >
                        <List size={15} />
                      </button>
                    </div>
                    <div className="popover-anchor">
                      <IconButton
                        label="Display options"
                        onClick={() => {
                          setDisplayMenu((v) => !v);
                          setFilterMenu(false);
                        }}
                      >
                        <SlidersHorizontal size={15} />
                      </IconButton>
                      {displayMenu && (
                        <div className="small-popover display-popover">
                          <span className="popover-label">DISPLAY OPTIONS</span>
                          <button onClick={() => setCompact((v) => !v)}>
                            <LayoutGrid size={13} />
                            <span>Compact cards</span>
                            <span className={`switch ${compact ? 'on' : ''}`} />
                          </button>
                          <button onClick={() => setSort((v) => !v)}>
                            <ArrowDownUp size={13} />
                            <span>Sort alphabetically</span>
                            {sort && <Check size={13} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {!loaded && !error ? (
                  <div className="loading-state">
                    <LoaderCircle className="spin" size={22} />
                    <span>Connecting your workspace…</span>
                  </div>
                ) : (
                  <LayoutGroup id="kanban">
                    {layout === 'board' ? (
                      <div className="kanban-board">
                        {columns.map((col) => {
                          const colTasks = (
                            view === 'my-tasks'
                              ? filtered.filter((t) => t.state === 'WAITING_HUMAN')
                              : filtered
                          ).filter((t) =>
                            col.state === 'WAITING_HUMAN'
                              ? ['WAITING_HUMAN', 'BLOCKED'].includes(t.state)
                              : col.state === 'TRIAGE' ? ['TRIAGE', 'QUEUED'].includes(t.state) : t.state === col.state,
                          );
                          const rootTasks = colTasks.filter((task) => !task.parent_task_id);
                          return (
                            <section
                              className={`kanban-column column-${col.className}`}
                              key={col.state}
                            >
                              <div className="column-heading">
                                <div>
                                  <col.icon
                                    size={15}
                                    className={`column-status ${col.className} ${col.state === 'EXECUTING' ? 'slow-spin' : ''}`}
                                  />
                                  <h2>{col.label}</h2>
                                  <span className="column-count">{colTasks.length}</span>
                                  {col.state === 'WAITING_HUMAN' && (
                                    <span className="hitl-tag">HITL</span>
                                  )}
                                </div>
                                <IconButton
                                  label={`Add a task to the workspace from ${col.label}`}
                                  onClick={() => setModal('task')}
                                  disabled={!project}
                                >
                                  <Plus size={14} />
                                </IconButton>
                              </div>
                              <div className="column-cards">
                                <AnimatePresence initial={false}>
                                  {rootTasks.map((task) => {
                                    const children = tasks.filter(
                                      (child) => child.parent_task_id === task.id,
                                    );
                                    return (
                                      <div className="task-group-item" key={task.id}>
                                        <TaskCard
                                          task={task}
                                          eventCount={
                                            events.filter(
                                              (e) =>
                                                e.task_id === task.id && e.event_type === 'COMMENT',
                                            ).length
                                          }
                                          onOpen={() => setSelected(task.id)}
                                          onApprove={() => approve(task)}
                                          busy={busy}
                                          compact={compact}
                                        />
                                        {children.length > 0 && (
                                          <div className="task-group-subtasks">
                                            {children.map((child) => (
                                              <TaskCard
                                                key={child.id}
                                                task={child}
                                                eventCount={events.filter(
                                                  (e) =>
                                                    e.task_id === child.id &&
                                                    e.event_type === 'COMMENT',
                                                ).length}
                                                onOpen={() => setSelected(child.id)}
                                                onApprove={() => approve(child)}
                                                busy={busy}
                                                compact
                                              />
                                            ))}
                                          </div>
                                        )}
                                        <button
                                          className="group-add-subtask"
                                          onClick={() => setSubtaskParent(task.id)}
                                        >
                                          <Plus size={12} /> Add subtask
                                        </button>
                                      </div>
                                    );
                                  })}
                                </AnimatePresence>
                                {!colTasks.length && (
                                  <div
                                    className={`column-empty ${col.state === 'DONE' ? 'done-empty' : ''}`}
                                  >
                                    {col.state === 'DONE' ? (
                                      <>
                                        <span className="done-empty-icon">
                                          <CheckCheck size={24} />
                                        </span>
                                        <strong>Good things take teamwork.</strong>
                                        <p>
                                          Approved work lands here.
                                          <br />
                                          Your next ship is one review away.
                                        </p>
                                      </>
                                    ) : (
                                      <>
                                        <col.icon size={20} />
                                        <span>
                                          {query || filter !== 'All tasks'
                                            ? 'No matching tasks'
                                            : 'Nothing here. Yet.'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                                <button className="column-add" onClick={() => setModal('task')} disabled={!project}>
                                  <Plus size={13} />
                                  Add task
                                </button>
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="task-list">
                        <div className="list-header">
                          <span>Task</span>
                          <span>Status</span>
                          <span>Queue</span>
                          <span>Priority</span>
                          <span>Subtasks</span>
                        </div>
                        {filtered.length ? (
                          filtered.map((t) => (
                            <button
                              className="task-row"
                              key={t.id}
                              onClick={() => setSelected(t.id)}
                            >
                              <span>
                                <span className="mono subtle">{t.id}</span>
                                <strong>{t.title}</strong>
                              </span>
                              <span className={`state-tag state-${t.state.toLowerCase()}`}>
                                {t.state.toLowerCase().replaceAll('_', ' ')}
                              </span>
                              <span>{t.is_agent_task ? t.agent_key : 'Human task'}</span>
                              <span>
                                <PriorityIcon priority={t.priority} />
                                {priorityLabel(t.priority)}
                              </span>
                              <span className="mono">
                                {tasks.filter((child) => child.parent_task_id === t.id).length}
                              </span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="A clean slate"
                            description="No tasks match these filters."
                          />
                        )}
                      </div>
                    )}
                  </LayoutGroup>
                )}
                <div className="workspace-bottom">
                  <div className="workspace-pulse">
                    <span className="pulse-label">
                      <Activity size={14} />
                      WORKSPACE PULSE
                    </span>
                    <span className="pulse-divider" />
                    <div className="pulse-avatars">
                      {project && (
                        <span className="project-pulse-mark">
                          {project.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span>
                      {completed.length
                        ? `${completed.length} task${completed.length > 1 ? 's' : ''} shipped. Keep the momentum going.`
                        : 'Project activity is up to date.'}
                    </span>
                    <span className="pulse-live">
                      <span className="breathing-dot" />
                      Live
                    </span>
                  </div>
                  <div className="board-footer">
                    <span>
                      <ShieldCheck size={12} />
                      Safe by design. Human by default.
                    </span>
                    <span>
                      <kbd>⌘ K</kbd> to search<span className="footer-dot">·</span>
                      <kbd>N</kbd> to create
                    </span>
                  </div>
                </div>
                </>}
              </>
            )}
            {view === 'activity' && (
              <section className="activity-page">
                <div className="section-toolbar">
                  <span>{events.length} project events</span>
                  <span className="live-indicator">
                    <span className="breathing-dot" />
                    Updating live
                  </span>
                </div>
                {[...events].reverse().map((e) => {
                  const a = actors.find((a) => a.id === e.actor_id);
                  return (
                    <button
                      className="activity-row"
                      key={e.id}
                      onClick={() => setSelected(e.task_id)}
                    >
                      <Avatar actor={a} size={32} />
                      <div>
                        <div>
                          <strong>{a?.handle}</strong>
                          <span className="event-tag">
                            {e.event_type.toLowerCase().replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p>{e.human_message}</p>
                      </div>
                      <span className="mono subtle">{e.task_id}</span>
                      <time>
                        {new Date(e.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                      <ArrowUpRight size={14} />
                    </button>
                  );
                })}
              </section>
            )}
            {view === 'integrations' && (
              <section className="integrations-page">
                <div className="integration-hero">
                  <span className="integration-visual">
                    <GitBranch size={32} />
                    <span />
                    <NexusLogo />
                    <span />
                    <Bot size={32} />
                  </span>
                  <h2>Your stack. One source of truth.</h2>
                  <p>
                    Webhook-first ingestion keeps your existing tools connected to the people and
                    external workers doing the work.
                  </p>
                </div>
                <div className="integration-grid">
                  {[
                    {
                      name: 'GitHub',
                      description:
                        'Issues and pull requests, automatically normalized into actionable tasks.',
                      Icon: GitPullRequest,
                      tag: 'SIGNED WEBHOOKS',
                    },
                    {
                      name: 'Support tickets',
                      description:
                        'Turn customer reports into structured work with context that carries through.',
                      Icon: Ticket,
                      tag: 'INGEST API',
                    },
                    {
                      name: 'Custom sources',
                      description:
                        'Connect your internal tools with a strictly validated, universal ingest endpoint.',
                      Icon: Globe,
                      tag: 'REST API',
                    },
                  ].map((i) => (
                    <article className="integration-card" key={i.name}>
                      <i.Icon size={28} />
                      <h3>{i.name}</h3>
                      <p>{i.description}</p>
                      <span>{i.tag}</span>
                      <Button onClick={() => setModal('integrations')}>
                        View setup
                        <ArrowUpRight size={14} />
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
          <footer className="app-statusbar">
            <span>
              <span className="status-dot executing" />
              Connected
              <span className="statusbar-divider" />
              {tasks.length} tasks
            </span>
            <span>
              NEXUSOPS <span className="mono">v0.1</span>
              <span className="statusbar-divider" />
              Built for the next way of working
              <ArrowUpRight size={11} />
            </span>
          </footer>
        </main>
        {statusMenu && (
          <div data-status-picker className="task-status-menu" role="menu" aria-label="Task status" style={{ left: statusMenu.x, top: statusMenu.y }}>
            <span className="task-status-menu-label">Status</span>
            {taskStatuses.map((status) => {
              const current = allTasks.find((task) => task.id === statusMenu.taskId);
              const active = current && taskStatusIndex(current.state) === taskStatusIndex(status.state);
              return <button key={status.state} role="menuitemradio" aria-checked={Boolean(active)} disabled={statusSaving} onClick={() => { void updateTaskStatus(statusMenu.taskId, status.state); setStatusMenu(null); }}><span className={`project-status-pill ${status.color}`}><CircleDot size={13} />{status.label}</span>{active && <Check size={14} />}</button>;
            })}
          </div>
        )}
        <AnimatePresence>
          {selectedTask && (
            <Inspector
              key="inspector"
              task={selectedTask}
              onClose={closeInspector}
              onApprove={() => approve(selectedTask)}
              busy={busy}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {modal === 'task' && project && (
            <CreateTask
              project={project}
              onClose={() => setModal(null)}
              onCreated={async () => {
                await refresh();
                setModal(null);
                toast.success('Task added to the project.');
              }}
            />
          )}
          {subtaskParent && project && (
            <CreateTask
              project={project}
              parentTaskId={subtaskParent}
              onClose={() => setSubtaskParent(null)}
              onCreated={async () => {
                await refresh();
                setSubtaskParent(null);
                toast.success('Subtask added to the task group.');
              }}
            />
          )}
          {modal === 'projects' && <ProjectManager onClose={() => setModal(null)} />}
          {modal === 'help' && (
            <Modal
              title="A workspace that moves with you."
              subtitle="A few shortcuts to keep you in flow."
              onClose={() => setModal(null)}
            >
              <div className="help-content">
                {[
                  ['Quick search', '⌘ K'],
                  ['Create a task', 'N'],
                  ['Close a panel', 'Esc'],
                  ['Send a comment', '⌘ Enter'],
                  ['Choose a mention', '↑ ↓ Enter'],
                ].map(([l, k]) => (
                  <div key={l}>
                    <span>{l}</span>
                    <kbd>{k}</kbd>
                  </div>
                ))}
                <p>
                  Create a task in the selected project or connect an integration to ingest work.
                </p>
              </div>
            </Modal>
          )}
          {modal === 'workspaces' && (
            <WorkspacePicker onClose={() => setModal(null)} onSwitch={selectWorkspace} />
          )}
          {modal === 'workspace-settings' && (
            <Modal
              title="Workspace settings"
              subtitle="Manage this workspace and its projects."
              onClose={() => setModal(null)}
            >
              <div className="settings-content">
                <div>
                  <label>Workspace</label>
                  <strong>{team.current?.name}</strong>
                  <span className="subtle">Your role: {team.current?.role}</span>
                  <Button onClick={() => setModal('workspaces')}>Switch or create workspace</Button>
                </div>
                <div>
                  <label>Appearance</label>
                  <div className="theme-buttons">
                    <Button
                      className={theme === 'dark' ? 'selected' : ''}
                      onClick={() => changeTheme('dark')}
                    >
                      <Moon size={16} />
                      Dark
                    </Button>
                    <Button
                      className={theme === 'light' ? 'selected' : ''}
                      onClick={() => changeTheme('light')}
                    >
                      <Sun size={16} />
                      Light
                    </Button>
                  </div>
                </div>
                <div>
                  <label>Projects</label>
                  <strong>{projects.length} in this workspace</strong>
                  <Button onClick={() => setModal('projects')}>Manage projects</Button>
                </div>
                <div>
                  <label>Storage</label>
                  <strong>
                    {storage === 'local-demo' ? 'Persistent local demo' : 'PostgreSQL'}
                  </strong>
                  <span className="subtle">
                    {storage === 'local-demo'
                      ? 'Changes are saved on this server in .data/workspace.json.'
                      : 'Workspace data is persisted in your configured database.'}
                  </span>
                </div>
              </div>
            </Modal>
          )}
          {modal === 'agents' && <AgentSettings key={team.current?.id} onClose={() => setModal(null)} />}
          {modal === 'developer' && <DeveloperSettings key={team.current?.id} onClose={() => setModal(null)} />}
          {modal === 'profile' && <ProfileSettings onClose={() => setModal(null)} />}
          {modal === 'members-settings' && (
            <Modal
              title="Members & settings"
              subtitle="Manage workspace access and your account."
              onClose={() => setModal(null)}
            >
              <div className="settings-content">
                <WorkspaceTeam user={user} />
                <div>
                  <label>Signed in as</label>
                  <strong>{user.name}</strong>
                  <span className="subtle">{user.email}</span>
                  <Button onClick={logout} disabled={loggingOut}>
                    <LogOut size={14} />
                    Log out
                  </Button>
                </div>
              </div>
            </Modal>
          )}
          {modal === 'integrations' && <IntegrationSetup onClose={() => setModal(null)} />}
        </AnimatePresence>
        <AnimatePresence>
          {commandOpen && (
            <Modal title="Find your next move" onClose={() => setCommandOpen(false)} wide>
              <div className="command-search">
                <Search size={19} />
                <input
                  autoFocus
                  placeholder="Search tasks or actions…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search workspace"
                />
                <kbd>ESC</kbd>
              </div>
              <div className="command-results">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelected(t.id);
                      setCommandOpen(false);
                      setQuery('');
                    }}
                  >
                    <FileCode2 size={16} />
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.id}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                {!query && (
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      setModal('task');
                    }}
                  >
                    <Plus size={17} />
                    <span>Create a task</span>
                    <kbd>N</kbd>
                  </button>
                )}
                {!filtered.length && (
                  <EmptyState
                    title="No matches yet"
                    description="Try another task title or agent handle."
                  />
                )}
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function NexusLogo() {
  return (
    <svg
      className="nexus-logo"
      viewBox="0 0 32 32"
      width="29"
      height="29"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 9.5 16 3l12 6.5v13L16 29 4 22.5v-13Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m4 9.5 12 7 12-7M16 16.5V29M10 6.3l12 7v13M4 16l12 7 12-7M10 26V13l12-7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function LayersIcon() {
  return <Workflow size={15} />;
}
function UserReviewIcon() {
  return <Users size={15} />;
}

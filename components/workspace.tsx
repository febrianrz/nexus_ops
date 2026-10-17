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
  Check,
  CheckCheck,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleDot,
  FileCode2,
  Filter,
  GitBranch,
  GitPullRequest,
  Globe,
  HelpCircle,
  Keyboard,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  LoaderCircle,
  Menu,
  Moon,
  Plus,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { WorkspacePicker, WorkspaceTeam } from './workspace-team';
import Inspector from './inspector';
import TaskCard from './task-card';
import { Avatar, Button, EmptyState, IconButton, Modal, PriorityIcon } from './ui';
import { CreateTask, IntegrationSetup, SpawnAgent } from './workspace-forms';
const columns: { state: TaskState; label: string; className: string; icon: typeof Circle }[] = [
  { state: 'TRIAGE', label: 'Triage', className: 'triage', icon: CircleDot },
  { state: 'QUEUED', label: 'Queued', className: 'queued', icon: Circle },
  { state: 'EXECUTING', label: 'Agent executing', className: 'executing', icon: LoaderCircle },
  { state: 'WAITING_HUMAN', label: 'Human review', className: 'review', icon: CircleDot },
  { state: 'DONE', label: 'Done', className: 'done', icon: CheckCheck },
];
const filters = ['All tasks', 'My approvals', 'Active agents', 'GitHub PRs'];
type ModalKind = 'task' | 'spawn' | 'help' | 'integrations' | 'settings' | 'workspaces' | null;
export default function Workspace({ user }: { user: SessionUser }) {
  const { tasks, actors, events, refresh, loaded, storage, team, switchWorkspace } = useWorkspace();
  const [view, setView] = useState('overview');
  const [filter, setFilter] = useState('All tasks');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [layout, setLayout] = useState('board');
  const [sidebar, setSidebar] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState<string | null>(null);
  const [priority, setPriority] = useState('ALL');
  const [filterMenu, setFilterMenu] = useState(false);
  const [displayMenu, setDisplayMenu] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const workspaceAdmin = team.current?.role === 'admin';
  function openSpawn() {
    if (!workspaceAdmin) {
      toast.info('Only workspace admins can register agents.');
      return;
    }
    setModal('spawn');
  }
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
  const [dockOpen, setDockOpen] = useState(true);
  useEffect(() => {
    const savedWorkspace = localStorage.getItem(`nexus-workspace:${user.id}`);
    if (savedWorkspace) useWorkspace.setState({ workspaceId: savedWorkspace });
    refresh().catch((e) => setError(e.message));
    const id = setInterval(() => refresh().catch(() => {}), 10000);
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
    const handler = (e: KeyboardEvent) => {
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setModal(null);
        setNotifications(false);
        setFilterMenu(false);
        setDisplayMenu(false);
      }
      if (!editing && e.key === 'n') setModal('task');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const selectedTask = tasks.find((t) => t.id === selected);
  const agents = actors.filter((a) => a.type === 'AGENT');
  const active = agents.filter((a) => a.status === 'EXECUTING');
  const review = tasks.filter((t) => t.state === 'WAITING_HUMAN');
  const running = tasks.filter((t) => t.state === 'EXECUTING');
  const completed = tasks.filter((t) => t.state === 'DONE');
  const filtered = useMemo(() => {
    let result = tasks.filter(
      (t) =>
        (!query ||
          `${t.title} ${t.id} ${t.labels.join(' ')}`.toLowerCase().includes(query.toLowerCase())) &&
        (priority === 'ALL' || t.priority === priority) &&
        (filter === 'All tasks' ||
          (filter === 'My approvals' && t.state === 'WAITING_HUMAN') ||
          (filter === 'Active agents' && t.state === 'EXECUTING') ||
          (filter === 'GitHub PRs' && t.source_type === 'GITHUB_PR')),
    );
    if (sort) result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [tasks, query, priority, filter, sort]);
  const closeInspector = useCallback(() => setSelected(null), []);
  function navigate(v: string) {
    setView(v);
    setSidebar(false);
    setFilter('All tasks');
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
    if (task.hop_count >= task.max_hops) {
      setSelected(task.id);
      await action(
        () => api(`/tasks/${task.id}`, 'PATCH', { action: 'resume' }),
        'Execution resumed · circuit breaker reset',
      );
    } else
      await action(
        () => api(`/tasks/${task.id}`, 'PATCH', { action: 'approve' }),
        'Task approved. Ready to merge in GitHub.',
      );
  }
  async function simulate(kind: string) {
    if (simulation) return;
    setSimulation(kind);
    try {
      if (kind === 'ingest') {
        const n = Date.now().toString().slice(-5);
        await api('/ingest', 'POST', {
          title: 'Add streaming responses to the agent SDK',
          description:
            'Support incremental agent responses with server-sent events and graceful client reconnection.',
          source_type: 'GITHUB_PR',
          source_ref: `nexus/sdk#${n}`,
          priority: 'MEDIUM',
          labels: ['sdk', 'enhancement'],
          context_payload: {
            repo: 'nexus/sdk',
            branch: 'feat/streaming-responses',
            test_command: 'npm test',
          },
        });
        await refresh();
        toast.success('Pull request ingested');
        if (actors.some((actor) => actor.handle === '@bot-triage' && actor.status !== 'OFFLINE'))
          toast('Triage agent picked up the task', {
            icon: <Avatar actor={actors.find((a) => a.handle === '@bot-triage')} size={20} />,
          });
      }
      if (kind === 'delegate' || kind === 'loop') {
        const available = agents.filter((actor) => actor.status !== 'OFFLINE');
        if (available.length < 2) {
          toast.info('Register at least two online agents to simulate a handoff.');
          return;
        }
        const task = tasks.find(
          (task) =>
            task.state !== 'DONE' &&
            task.hop_count < (kind === 'loop' ? task.max_hops : task.max_hops - 1),
        );
        if (!task) {
          toast.info('Create a task to start another handoff.');
          return;
        }
        let current = task;
        do {
          const target = available.find((actor) => actor.id !== current.assignee_id)!;
          current = await api<Task>(`/tasks/${task.id}/delegate`, 'POST', {
            target_handle: target.handle,
            message: `Passing context to ${target.handle} for review.`,
          });
          await refresh();
          if (kind === 'delegate') {
            toast.success(`Handoff complete → ${target.handle}`, { description: task.id });
            break;
          }
          if (current.hop_count < current.max_hops)
            await new Promise((resolve) => setTimeout(resolve, 500));
        } while (current.hop_count < current.max_hops);
        if (kind === 'loop')
          toast.warning('Circuit breaker tripped. Human review required.', {
            description: `${task.id} paused at ${current.hop_count}/${current.max_hops} hops.`,
          });
      }
      if (kind === 'spawn') {
        if (!workspaceAdmin) {
          toast.info('Only workspace admins can register agents.');
          return;
        }
        const suffix = Date.now().toString().slice(-6);
        const parent = agents.find((actor) => actor.handle === '@bot-qa') ?? agents[0];
        const response = await api<{ actor: Actor; token: string }>('/actors/agents', 'POST', {
          handle: `@bot-sec-${suffix}`,
          display_name: `Security scanner ${suffix}`,
          parent_agent_id: parent?.id ?? null,
          capabilities: ['security', 'dependency audit'],
        });
        await refresh();
        toast.success(parent ? 'Ephemeral sub-agent is online' : 'New agent is online', {
          description: parent
            ? `${response.actor.handle} · spawned by ${parent.handle}`
            : response.actor.handle,
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSimulation(null);
    }
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
    >
      <Icon size={17} />
      <span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
      {view === id && <span className="nav-active-dot" />}
    </button>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Toaster
          position="bottom-right"
          theme={theme === 'dark' ? 'dark' : 'light'}
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: 'inherit' } }}
        />
        {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)} />}
        <aside className={`sidebar ${sidebar ? 'mobile-open' : ''}`}>
          <a className="brand" href="/" aria-label="NexusOps home">
            <NexusLogo />
            <span>
              Nexus<span className="brand-ops">Ops</span>
            </span>
            <span className="brand-dot" />
          </a>
          <button className="workspace-switcher" onClick={() => setModal('workspaces')}>
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
          <button className="sidebar-search" onClick={() => setCommandOpen(true)}>
            <Search size={15} />
            <span>Quick search</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {navItem('overview', 'Overview', LayoutDashboard)}
            {navItem('my-tasks', 'My approvals', CheckCheck, review.length)}
            {navItem('fleet', 'Agent fleet', Bot, agents.length)}
            {navItem('activity', 'Activity', Activity)}
            <div className="nav-caption tools-caption">CONNECT</div>
            {navItem('integrations', 'Integrations', GitBranch)}
            <button className="nav-item" onClick={() => setModal('settings')}>
              <Settings2 size={17} />
              <span>Members &amp; settings</span>
            </button>
          </nav>
          <div className="fleet-mini">
            <div className="fleet-mini-header">
              <span>
                <Radio size={13} /> AGENT FLEET
              </span>
              <span className="online-tag">
                {agents.filter((a) => a.status !== 'OFFLINE').length} online
              </span>
            </div>
            {agents.slice(0, 4).map((a) => (
              <button className="mini-agent" key={a.id} onClick={() => navigate('fleet')}>
                <Avatar actor={a} size={27} />
                <span>
                  <strong>{a.handle.replace('@', '')}</strong>
                  <small>
                    {a.status === 'EXECUTING'
                      ? 'Working on a task'
                      : a.status === 'OFFLINE'
                        ? 'Offline'
                        : 'Ready for a task'}
                  </small>
                </span>
                <span className={`mini-status ${a.status.toLowerCase()}`} />
              </button>
            ))}
            <button className="add-agent" onClick={() => openSpawn()}>
              <Plus size={13} />
              Register an agent
              <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button className="support-link" onClick={() => setModal('help')}>
              <HelpCircle size={16} />
              <span>Help & shortcuts</span>
              <Keyboard size={14} />
            </button>
            <button className="profile" onClick={() => setModal('settings')}>
              <Avatar actor={currentActor} size={33} active />
              <span>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <ChevronsUpDown size={14} />
            </button>
          </div>
        </aside>
        <main className="main-workspace">
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
                  : view === 'my-tasks'
                    ? 'My approvals'
                    : view === 'fleet'
                      ? 'Agent fleet'
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
              <div className="notification-anchor">
                <IconButton label="Notifications" onClick={() => setNotifications((v) => !v)}>
                  <Bell size={17} />
                  <span className="notification-dot" />
                </IconButton>
                <AnimatePresence>
                  {notifications && (
                    <motion.div
                      className="notification-popover"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <h3>
                        Your inbox<span>{review.length}</span>
                      </h3>
                      {review.length ? (
                        review.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelected(t.id);
                              setNotifications(false);
                            }}
                          >
                            <span className="notification-icon">
                              <CheckCheck size={16} />
                            </span>
                            <span>
                              <strong>Ready for your review</strong>
                              <small>{t.title}</small>
                            </span>
                            <ArrowUpRight size={13} />
                          </button>
                        ))
                      ) : (
                        <p>You’re all caught up. Nice work.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Avatar actor={currentActor} size={27} />
              <Button
                className="logout-button"
                onClick={logout}
                disabled={loggingOut}
                aria-label="Log out"
              >
                <LogOut size={15} />
                <span>{loggingOut ? 'Signing out…' : 'Log out'}</span>
              </Button>
            </div>
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="heading-title">
                  <h1>
                    {view === 'fleet'
                      ? 'Meet your extended team.'
                      : view === 'activity'
                        ? 'Every move, in the open.'
                        : view === 'integrations'
                          ? 'Bring your work together.'
                          : view === 'my-tasks'
                            ? 'Your judgment. Their momentum.'
                            : 'Human ingenuity. Agent velocity.'}
                  </h1>
                  <span className="workspace-badge">
                    <span />
                    LIVE WORKSPACE
                  </span>
                </div>
                <p>
                  {view === 'fleet'
                    ? 'Specialized agents. Shared context. A team that scales with you.'
                    : view === 'activity'
                      ? 'One continuous timeline of humans and agents moving work forward.'
                      : view === 'integrations'
                        ? 'Turn issues, pull requests, and support tickets into coordinated action.'
                        : view === 'my-tasks'
                          ? 'A little human oversight goes a long way. Here’s what needs your attention.'
                          : 'Your tasks. Your agents. One workspace.'}
                </p>
              </div>
              <Button
                className="primary new-task"
                onClick={() => (view === 'fleet' ? openSpawn() : setModal('task'))}
              >
                <Plus size={16} />
                {view === 'fleet' ? 'Spawn agent' : 'Create task'}
                <kbd>N</kbd>
              </Button>
            </div>
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
            {(view === 'overview' || view === 'my-tasks') && (
              <>
                <section className="overview-stats" aria-label="Workspace summary">
                  <div className="stat">
                    <div className="stat-label">
                      <LayersIcon />
                      Tasks in motion
                    </div>
                    <div className="stat-value">
                      {String(tasks.filter((t) => t.state !== 'DONE').length).padStart(2, '0')}
                      <span className="stat-change">
                        <span className="little-dot" />
                        Across your workspace
                      </span>
                    </div>
                    <div className="stat-track">
                      {['TRIAGE', 'QUEUED', 'EXECUTING', 'WAITING_HUMAN', 'DONE']
                        .filter((state) => tasks.some((task) => task.state === state))
                        .map((s) => (
                          <span
                            key={s}
                            className={`track-${s.toLowerCase()}`}
                            style={{
                              flex: tasks.filter((t) => t.state === s).length,
                            }}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">
                      <Bot size={15} />
                      Agents at work
                    </div>
                    <div className="stat-value">
                      {String(active.length).padStart(2, '0')}
                      <span className="stat-avatars">
                        {active.map((a) => (
                          <Avatar key={a.id} actor={a} size={25} />
                        ))}
                      </span>
                    </div>
                    <p>
                      <span className="status-dot executing" />
                      {agents.length - active.length} more ready when you are
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
                      {String(review.length).padStart(2, '0')}
                      <span className="approval-stat-label">
                        Human review
                        <ArrowUpRight size={12} />
                      </span>
                    </div>
                    <p>A final check. A confident ship.</p>
                  </button>
                  <div className="stat guardrail-stat">
                    <div className="stat-label">
                      <ShieldCheck size={15} />
                      Autonomy with guardrails
                    </div>
                    <div className="guardrail-title">
                      <span className="guardrail-icon">
                        <ShieldCheck size={20} />
                      </span>
                      <strong>You’re in control.</strong>
                    </div>
                    <p>4-hop limit. Human approval. Always.</p>
                  </div>
                </section>
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
                    <button onClick={() => navigate('fleet')}>
                      <Bot size={16} />
                      Agent fleet<span>{agents.length}</span>
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
                          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
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
                              <span>{p === 'ALL' ? 'All priorities' : p.toLowerCase()}</span>
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
                              : t.state === col.state,
                          );
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
                                >
                                  <Plus size={14} />
                                </IconButton>
                              </div>
                              <div className="column-cards">
                                <AnimatePresence initial={false}>
                                  {colTasks.map((task) => (
                                    <TaskCard
                                      key={task.id}
                                      task={task}
                                      actors={actors}
                                      eventCount={
                                        events.filter(
                                          (e) =>
                                            e.task_id === task.id && e.event_type === 'COMMENT',
                                        ).length
                                      }
                                      onOpen={() => setSelected(task.id)}
                                      onApprove={() =>
                                        task.hop_count >= 4 ? setSelected(task.id) : approve(task)
                                      }
                                      busy={busy}
                                      compact={compact}
                                    />
                                  ))}
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
                                <button className="column-add" onClick={() => setModal('task')}>
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
                          <span>Assignee</span>
                          <span>Priority</span>
                          <span>Hops</span>
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
                              <span>
                                <Avatar
                                  actor={actors.find((a) => a.id === t.assignee_id)}
                                  size={23}
                                />
                                {actors.find((a) => a.id === t.assignee_id)?.handle}
                              </span>
                              <span>
                                <PriorityIcon priority={t.priority} />
                                {t.priority.toLowerCase()}
                              </span>
                              <span className="mono">{t.hop_count}/4</span>
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
                      {agents.slice(0, 3).map((a) => (
                        <Avatar key={a.id} actor={a} size={20} />
                      ))}
                    </div>
                    <span>
                      {simulation
                        ? 'Your agents are making moves…'
                        : completed.length
                          ? `${completed.length} task${completed.length > 1 ? 's' : ''} shipped. Keep the momentum going.`
                          : 'Your humans and agents are on the same page.'}
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
              </>
            )}
            {view === 'fleet' && (
              <section className="fleet-page">
                <div className="section-toolbar">
                  <div>
                    <span className="status-dot executing" />
                    {agents.filter((a) => a.status !== 'OFFLINE').length} agents online{' '}
                    <span className="subtle">/ {agents.length} registered</span>
                  </div>
                  <Button onClick={() => openSpawn()}>
                    <Terminal size={14} />
                    Register via API
                    <ArrowUpRight size={13} />
                  </Button>
                </div>
                <div className="fleet-grid">
                  {agents.map((a, i) => (
                    <motion.article
                      className="fleet-card"
                      key={a.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="fleet-card-top">
                        <Avatar actor={a} size={43} active={a.status === 'EXECUTING'} />
                        <span className={`agent-state ${a.status.toLowerCase()}`}>
                          <i />
                          {a.status === 'EXECUTING'
                            ? 'Executing'
                            : a.status === 'IDLE'
                              ? 'Available'
                              : 'Offline'}
                        </span>
                      </div>
                      <h3>{a.display_name}</h3>
                      <span className="fleet-handle mono">{a.handle}</span>
                      <div className="fleet-capabilities">
                        {a.capabilities.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                      </div>
                      {a.parent_agent_id ? (
                        <div className="parent-agent">
                          <GitBranch size={13} />
                          <span>
                            Spawned by{' '}
                            <strong>
                              {actors.find((p) => p.id === a.parent_agent_id)?.handle}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <div className="parent-agent">
                          <Bot size={13} />
                          Core workspace agent
                        </div>
                      )}
                      <div className="fleet-card-footer">
                        <span>
                          {tasks.filter((t) => t.assignee_id === a.id && t.state !== 'DONE').length}{' '}
                          assigned tasks
                        </span>
                        <button
                          className={`switch ${a.status !== 'OFFLINE' ? 'on' : ''}`}
                          role="switch"
                          aria-label={`Toggle ${a.handle} online`}
                          aria-checked={a.status !== 'OFFLINE'}
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(`/actors/${a.id}`, 'PATCH', {
                                  status: a.status === 'OFFLINE' ? 'IDLE' : 'OFFLINE',
                                }),
                              `${a.handle} ${a.status === 'OFFLINE' ? 'is online' : 'paused'}`,
                            )
                          }
                        />
                      </div>
                    </motion.article>
                  ))}
                  <button className="spawn-card" onClick={() => openSpawn()}>
                    <span>
                      <Plus size={24} />
                    </span>
                    <strong>Make room for one more.</strong>
                    <p>
                      Give your team a new capability.
                      <br />
                      Spawn a specialized agent.
                    </p>
                    <span className="spawn-card-link">
                      Spawn agent
                      <ArrowRight size={14} />
                    </span>
                  </button>
                </div>
                <div className="fleet-info">
                  <GitBranch size={19} />
                  <div>
                    <strong>Small agents. Shared intelligence.</strong>
                    <p>
                      Agents can spawn specialized sub-agents, pass context, and delegate work.
                      Every handoff is recorded. Every chain has a limit.
                    </p>
                  </div>
                  <span className="guardrail-chip">
                    <ShieldCheck size={14} />
                    4-hop circuit breaker
                  </span>
                </div>
              </section>
            )}
            {view === 'activity' && (
              <section className="activity-page">
                <div className="section-toolbar">
                  <span>{events.length} workspace events</span>
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
                    agents doing the work.
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
          <AnimatePresence>
            {dockOpen ? (
              <motion.div
                className="simulator-dock"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 28 }}
              >
                <div className="dock-label">
                  <span className="dock-orb">
                    <Zap size={17} />
                  </span>
                  <div>
                    <strong>Take it for a spin</strong>
                    <span>LIVE AGENT SIMULATOR</span>
                  </div>
                </div>
                <div className="dock-divider" />
                <div className="dock-actions">
                  {[
                    {
                      id: 'ingest',
                      label: 'Ingest a PR',
                      Icon: GitPullRequest,
                      title: 'Simulate GitHub PR ingest',
                    },
                    {
                      id: 'delegate',
                      label: 'Trigger handoff',
                      Icon: ArrowRight,
                      title: 'Delegate from coder to QA',
                    },
                    {
                      id: 'loop',
                      label: 'Test the guardrails',
                      Icon: ShieldCheck,
                      title: 'Simulate infinite loop and trip the circuit breaker',
                    },
                    {
                      id: 'spawn',
                      label: agents.length ? 'Spawn sub-agent' : 'Spawn agent',
                      Icon: Bot,
                      title: 'Spawn an ephemeral agent via API',
                    },
                  ].map((s) => (
                    <Button
                      key={s.id}
                      className={`dock-action ${simulation === s.id ? 'simulating' : ''}`}
                      disabled={!!simulation || !loaded}
                      title={s.title}
                      onClick={() => simulate(s.id)}
                    >
                      {simulation === s.id ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <s.Icon size={15} />
                      )}
                      <span>{s.label}</span>
                    </Button>
                  ))}
                </div>
                <IconButton
                  label="Minimize simulator"
                  className="dock-close"
                  onClick={() => setDockOpen(false)}
                >
                  <X size={13} />
                </IconButton>
                <span className="dock-shortcut">DEMO</span>
              </motion.div>
            ) : (
              <motion.button
                className="reopen-dock"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setDockOpen(true)}
              >
                <Zap size={15} />
                Open simulator
              </motion.button>
            )}
          </AnimatePresence>
          <footer className="app-statusbar">
            <span>
              <span className="status-dot executing" />
              Connected
              <span className="statusbar-divider" />
              {agents.length} agents
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
          {modal === 'task' && (
            <CreateTask
              onClose={() => setModal(null)}
              triageActor={actors.find(
                (actor) =>
                  actor.handle === '@bot-triage' &&
                  actor.type === 'AGENT' &&
                  actor.status !== 'OFFLINE',
              )}
              onCreated={async () => {
                await refresh();
                setModal(null);
                toast.success('Task created. Your team can take it from here.');
              }}
            />
          )}
          {modal === 'spawn' && workspaceAdmin && (
            <SpawnAgent actors={actors} onClose={() => setModal(null)} refresh={refresh} />
          )}{' '}
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
                  Try the simulator dock to ingest a pull request, hand off work, test the
                  delegation circuit breaker, or spawn a sub-agent.
                </p>
                <Button
                  className="primary"
                  onClick={() => {
                    setModal(null);
                    setDockOpen(true);
                  }}
                >
                  Explore the simulator
                  <Zap size={14} />
                </Button>
              </div>
            </Modal>
          )}
          {modal === 'workspaces' && (
            <WorkspacePicker onClose={() => setModal(null)} onSwitch={selectWorkspace} />
          )}
          {modal === 'settings' && (
            <Modal
              title="Workspace settings"
              subtitle="A place for your people and your agents."
              onClose={() => setModal(null)}
            >
              <div className="settings-content">
                <WorkspaceTeam user={user} />
                <div>
                  <label>Signed in as</label>
                  <strong>{user.name}</strong>
                  <span className="subtle">{user.email}</span>
                  <span className="subtle mono">Integration workspace: {team.current?.id}</span>
                  <Button onClick={logout} disabled={loggingOut}>
                    <LogOut size={14} />
                    Log out
                  </Button>
                </div>
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
                  <label>Delegation guardrails</label>
                  <strong>4 hops · Human approval required</strong>
                  <span className="subtle">
                    The circuit breaker pauses execution before a delegation chain can loop.
                  </span>
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
          {modal === 'integrations' && <IntegrationSetup onClose={() => setModal(null)} />}
        </AnimatePresence>
        <AnimatePresence>
          {commandOpen && (
            <Modal title="Find your next move" onClose={() => setCommandOpen(false)} wide>
              <div className="command-search">
                <Search size={19} />
                <input
                  autoFocus
                  placeholder="Search tasks, agents, or actions…"
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
                {agents
                  .filter((a) =>
                    `${a.handle} ${a.display_name}`.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        navigate('fleet');
                        setCommandOpen(false);
                        setQuery('');
                      }}
                    >
                      <Avatar actor={a} />
                      <span>
                        <strong>{a.display_name}</strong>
                        <small>{a.handle}</small>
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
                {!filtered.length &&
                  !agents.some((a) =>
                    `${a.handle} ${a.display_name}`.toLowerCase().includes(query.toLowerCase()),
                  ) && (
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

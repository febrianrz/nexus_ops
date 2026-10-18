'use client';
import { api, useWorkspace } from '@/lib/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal } from './ui';

export default function ProjectManager({ onClose }: { onClose: () => void }) {
  const { projects, selectedProjectId, selectProject, refresh, team } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title="Projects"
      subtitle="Keep tasks and subtasks organized inside this workspace."
      onClose={onClose}
    >
      <div className="project-list">
        {projects.map((project) => (
          <button
            key={project.id}
            className={`project-option ${project.id === selectedProjectId ? 'selected' : ''}`}
            onClick={() => {
              selectProject(project.id);
              localStorage.setItem(`nexus-project:${team.current?.id}`, project.id);
              onClose();
            }}
          >
            <span>
              <strong>{project.name}</strong>
              <small>{project.description || 'No description'}</small>
            </span>
            {project.id === selectedProjectId && <span className="little-dot" />}
          </button>
        ))}
      </div>
      <form
        className="task-form project-create"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await api('/projects', 'POST', { name, description });
            await refresh();
            const created = useWorkspace
              .getState()
              .projects.find((project) => project.name === name.trim());
            if (created) {
              selectProject(created.id);
              localStorage.setItem(`nexus-project:${team.current?.id}`, created.id);
            }
            toast.success('Project created');
            onClose();
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          New project
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Mobile app"
          />
        </label>
        <label>
          Description <span className="subtle">optional</span>
          <input
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in this project?"
          />
        </label>
        <div className="form-footer">
          <Button type="submit" className="primary" disabled={saving}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

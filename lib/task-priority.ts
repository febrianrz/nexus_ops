import type { Priority } from './types';

export const priorityOptions: { value: Priority; label: string; shortcut: string }[] = [
  { value: 'CRITICAL', label: 'Urgent', shortcut: '1' },
  { value: 'HIGH', label: 'High', shortcut: '2' },
  { value: 'MEDIUM', label: 'Normal', shortcut: '3' },
  { value: 'LOW', label: 'Low', shortcut: '4' },
  { value: 'NONE', label: 'Clear', shortcut: '0' },
];
export const priorityLabel = (value: Priority) => value === 'NONE' ? 'No priority' : priorityOptions.find((option) => option.value === value)?.label ?? value;

export enum ArtifactType {
  SPEC = 'spec',
  DESIGN = 'design',
  API = 'api',
  UI = 'ui',
  TASK = 'task',
  QUESTION = 'question',
}

export enum ArtifactStatus {
  DRAFT = 'draft',
  NEEDS_REVIEW = 'needs_review',
  APPROVED = 'approved',
  BLOCKED = 'blocked',
  DONE = 'done',
}

export enum Role {
  DEV = 'dev',
  DESIGNER = 'designer',
  PM = 'pm',
  BACKEND = 'backend',
  FRONTEND = 'frontend',
}

export enum OwnerRole {
  DESIGN = 'design',
  DEV = 'dev',
  PM = 'pm',
  BACKEND = 'backend',
  FRONTEND = 'frontend',
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: number;
}

export interface TeamMember {
  id: string;
  username: string;
  display_name: string;
  role: string;
  member_role: string;
}

export interface Artifact {
  id: string;
  team_id: string;
  type: ArtifactType;
  title: string;
  content: string;
  owner_role: OwnerRole;
  status: ArtifactStatus;
  dependencies: string[];
  created_by: string;
  created_at: number;
  updated_at: number;
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  thread_id?: string;
  author: string;
  role: Role;
  content: string;
  attachments: string[];
  mentions: string[];
  created_at: number;
}

export interface Thread {
  id: string | null;
  artifact_id: string;
  resolved: boolean;
  messages: Message[];
}

export interface ActiveUser {
  user_id: string;
  role: string;
  display_name: string;
  current_artifact: string | null;
  last_seen: number;
  websocket_id?: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  text_offset: number;
}

export interface WsMessage {
  type: string;
  artifact_id?: string;
  user_id?: string;
  position?: CursorPosition;
  content?: string;
  message?: any;
  timestamp?: number;
}

export interface FileInfo {
  id: string;
  filename: string;
  path: string;
  uploaded_by: string;
  artifact_id: string | null;
  size: number;
  created_at: number;
  url: string;
}

export interface ArtifactStats {
  total_artifacts: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  total_messages: number;
  unresolved_threads: number;
}

export const ROLE_COLORS: Record<string, string> = {
  dev: '#00E89C',
  designer: '#7C5CFC',
  pm: '#FF8C42',
  backend: '#3B9EFF',
  frontend: '#FF5E88',
};

export const TYPE_COLORS: Record<string, string> = {
  spec: '#7C5CFC',
  design: '#FF5E88',
  api: '#3B9EFF',
  ui: '#FF8C42',
  task: '#00E89C',
  question: '#FF3B5C',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: '#5C5C78',
  needs_review: '#FFB347',
  approved: '#00F5A0',
  blocked: '#FF4757',
  done: '#7C5CFC',
};

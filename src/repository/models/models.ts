export type User = {
  id: string;
  azureProfileId: string;
  email: string;
  name: string;
  organizations?: Array<string>;
};

export type Organization = {
  id: string;
  azureId: string;
  name: string;
  projects?: Array<string>;
};

export type Project = {
  id: string;
  azureId: string;
  name: string;
};

export type Task = {
  id: string;
  name: string;
  state: TaskState;
  plannedAt: number;
  azureId?: number;
  azureState?: TaskState;
  azureUrl?: string;
};

export type TaskState = 'created' | 'done' | 'progress' | 'failed' | 'cancelled'



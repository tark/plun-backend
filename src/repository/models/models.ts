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
  // array of states
  // for example for the first day task was "created"
  // for the second day state was "in progress"
  // and for the third day it becomes "done"
  state: Array<DayState>;
  // all the days when task was planned
  // for example one task can moves from one day to another
  plannedAt: Array<number>;
  azureId?: number;
  azureState?: TaskState;
  azureUrl?: string;
};

export type DayState = {
  date: number,
  state: TaskState,
}

export type TaskState = 'created' | 'done' | 'progress' | 'failed' | 'cancelled'



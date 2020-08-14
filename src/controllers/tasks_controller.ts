import TasksRepository from "../repository/tasks_repository";

export default class TasksController {

  tasksRepository: TasksRepository

  constructor(tasksRepository: TasksRepository) {
    this.tasksRepository = tasksRepository;
  }

}

import TasksDb from "./db/tasks_db.js";
import Logger from "../util/logger.js";

const L = new Logger('TasksRepository');

export default class TasksRepository {

  constructor(db) {
    this.tasksDb = new TasksDb(db)
  }

  get = (id) => {
    L.i(`get - ${id}`)
    return this.tasksDb.getById(id);
  }

  add = async (task) => {
    L.i(`add - ${task.name}`)
    return this.tasksDb.add(task);
  }

  getSuggestions = async (query) => {
    // get list of tasks from azure api
  }

  delete = async (id) => {
    L.i(`delete - ${id}`)
    return this.tasksDb.delete(id);
  }

  tasks = () => {
    return this.tasksDb.collection('tasks');
  }

}

import TasksDb from "./db/tasks_db";
import Logger from "../util/logger";
import {firestore} from "firebase";
import {Task} from "./models/models";

const L = new Logger('TasksRepository');

export default class TasksRepository {

  tasksDb: TasksDb;

  constructor(db : firestore.Firestore) {
    this.tasksDb = new TasksDb(db)
  }

  get = (id : string) => {
    L.i(`get - ${id}`)
    return this.tasksDb.getById(id);
  }

  /*add = async (task : Task) => {
    L.i(`add - ${task.name}`)
    return this.tasksDb.add(task);
  }*/

  getSuggestions = async (query : string) => {
    // get list of tasks from azure api
  }

  delete = async (id : string) => {
    L.i(`delete - ${id}`)
    return this.tasksDb.delete(id);
  }

  /*tasks = () => {
    return this.tasksDb.collection('tasks');
  }*/

}

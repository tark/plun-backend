import TasksDb from "./db/tasks_db";
import Logger from "../util/logger";
import {firestore} from "firebase";
import {Task} from "./models/models";
import AzureApi from "./api/azure_api";

const L = new Logger('TasksRepository');

/**
 * Class responsible for keeping the data.
 * It manipulates API and DB
 */
export default class TasksRepository {

  tasksDb: TasksDb;
  azureApi: AzureApi;

  constructor(db: firestore.Firestore, azureApi: AzureApi) {
    this.tasksDb = new TasksDb(db)
    this.azureApi = azureApi
  }

  get = (id: string): Promise<Task> => {
    L.i(`get - ${id}`)
    if (!id) {
      return null;
    }
    return this.tasksDb.getById(id);
  }

  getTasksByDate = async (organizationName: string,
                          projectName: string,
                          date: number,
                          token: string): Promise<Array<Task>> => {
    // get tasks from db
    // get those tasks from azureApi (because name, url and state can change)
    // return to user
    const tasksFromDb = await this.tasksDb.getByDate(date)

    return this.tasksFromDbToTasksFromApi(tasksFromDb, organizationName, projectName, token)
  }

  getPreviousNearestTasks = async (organizationName: string,
                                  projectName: string,
                                  token: string): Promise<Array<Task>> => {
    L.i(`getNearestPlannedTasks`)
    const tasksFromDb = await this.tasksDb.getPreviousNearestTasks()

    return this.tasksFromDbToTasksFromApi(tasksFromDb, organizationName, projectName, token)

  }

  addTasks = async (tasks: Array<Task>): Promise<boolean> => {
    L.i(`add - ${tasks.length}`)
    return this.tasksDb.addTasks(tasks);
  }

  getSuggestions = async (query: string) => {
    // get list of tasks from azure api
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    return this.tasksDb.delete(id);
  }

  update = async (task: Task): Promise<Task> => {
    L.i(`update - ${task.name}`)
    return this.tasksDb.update(task);
  }

  /**
   * Converts tasks from DB to tasks from API
   * We need this conversion, because names can changes
   */
  tasksFromDbToTasksFromApi = async (tasksFromDb: Array<Task>,
                                     organizationName: string,
                                     projectName: string,
                                     token: string): Promise<Array<Task>> => {
    const tasksFromApi = await this.azureApi.getTasksByIds(
      organizationName,
      projectName,
      tasksFromDb.map(t => t.azureId).filter(id => !!id),
      token,
    )

    return tasksFromDb.map(t => {
      const accordingTaskFromApi = tasksFromApi.find(t1 => t1.azureId == t.azureId)

      // if there is no tasks in api - that mean this is our inner task
      // not all the tasks are in api. User can create one simple task for tomorrow.
      if (!accordingTaskFromApi) {
        return t;
      }

      // if there IS api task - we planned azure task.
      // let's return it and add there some fields from db tasks
      return {
        ...accordingTaskFromApi,
        plannedAt: t.plannedAt,
        state: t.state,
        id: t.id,
      }

    })
  }

}

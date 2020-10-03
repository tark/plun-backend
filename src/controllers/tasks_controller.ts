import TasksRepository from "../repository/tasks_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {firestore} from "firebase";
import Logger from "../util/logger";
import {Task} from "../repository/models/models";

const L = new Logger('TasksController');

/**
 * Class for business logic related to tasks
 */
export default class TasksController {

  cache: Cache;
  azureApi: AzureApi;
  tasksRepository: TasksRepository

  constructor(db: firestore.Firestore, cache: Cache, azureApi: AzureApi) {
    this.tasksRepository = new TasksRepository(db, azureApi);
    this.azureApi = azureApi
    this.cache = cache
  }

  getSuggestions = async (organizationName: string,
                          projectName: string,
                          query: string,
                          token: string) => {
    L.i(`getSuggestions`)
    return this.azureApi.searchTasks(organizationName, projectName, query, token);
  }

  planTasks = async (tasks: Array<Task>) => {
    L.i(`planTasks`)
    const todayMidnight = new Date();
    todayMidnight.setHours(0);
    todayMidnight.setMinutes(0);
    todayMidnight.setSeconds(0);
    todayMidnight.setMilliseconds(0);

    // todo check if the previous state is wrong
    // like we go from done to construction
    // we need to return an error
    // later

    // when we planning tasks, we add plannedAt time
    // and add a state there
    await Promise.all(tasks.map(async (t) => {
      const sameTaskFromDb = await this.tasksRepository.get(t.id ?? '');
      // check if the task is already here
      if (sameTaskFromDb) {
        // if so - add new plannedAt to it - that mean we plan the task for this day also
        await this.tasksRepository.update({
           ...t,
           plannedAt: [
             ...t.plannedAt,
             todayMidnight.getTime()
           ],
         });
      } else {
        // else add this task - this is a new task
        await this.tasksRepository.addTasks([{
          ...t,
          plannedAt: [todayMidnight.getTime()],
          state: [{
            date: todayMidnight.getTime(),
            state: 'created',
          }],
        }])
      }
    }))
  }

  /**
   * Returns planned tasks by given date
   */
  getPlannedTasks = (organizationName: string,
                     projectName: string,
                     date: number,
                     token: string): Promise<Array<Task>> => {
    L.i(`getPlannedTasks - ${new Date(date)}`)
    const dateMidnight = new Date(date)
    dateMidnight.setHours(0);
    dateMidnight.setMinutes(0);
    dateMidnight.setSeconds(0);
    dateMidnight.setMilliseconds(0);
    return this.tasksRepository.getTasksByDate(
      organizationName,
      projectName,
      dateMidnight.getTime(),
      token
    );
  }

  /**
   * Returns nearest available planned tasks
   * Looks for what nearest day has tasks
   * After found it - return all the tasks for this day
   */
  getPreviousNearestTasks = (organizationName: string,
                             projectName: string,
                             token: string) => {

    return this.tasksRepository.getPreviousNearestTasks(
      organizationName,
      projectName,
      token
    );


  }

  deleteTask = (taskId: string) => {
    return this.tasksRepository.delete(taskId);
  }

  updateTask = (task: Task) : Promise<Task> => {
    return this.tasksRepository.update(task);
  }

}

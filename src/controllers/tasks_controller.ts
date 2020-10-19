import TasksRepository from "../repository/tasks_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {firestore} from "firebase";
import Logger from "../util/logger";
import {Task} from "../repository/models/models";
import moment from "moment";

const L = new Logger('TasksController');

/**
 * Class for business logic related to tasks
 */
export default class TasksController {

  cache: Cache;
  azureApi: AzureApi;
  tasksRepository: TasksRepository

  constructor(db: firestore.Firestore,
              cache: Cache,
              azureApi: AzureApi,
              tasksRepository: TasksRepository) {
    this.tasksRepository = tasksRepository;
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

  /*planTasks = async (tasks: Array<Task>) => {
    L.i(`planTasks`)

    // todo check if the previous state is wrong
    // like we go from done to construction
    // we need to return an error
    // later

    // when we planning tasks, we add plannedAt time
    // and add a state there

    const todayFormatted = moment().format('YYYY-MM-DD')

    await Promise.all(tasks.map(async (t) => {
      const sameTaskFromDb = await this.tasksRepository.get(t.id ?? '');
      // check if the task is already here
      if (sameTaskFromDb) {
        // if so - add new plannedAt to it - that mean we plan the task for this day also
        await this.tasksRepository.update({
          ...t,
          plannedAt: [
            ...t.plannedAt,
            todayFormatted
          ],
        });
      } else {
        // else add this task - this is a new task
        await this.tasksRepository.addTasks([{
          ...t,
          plannedAt: [
            todayFormatted
          ],
          state: [{
            date: todayFormatted,
            state: 'created',
          }],
        }])
      }
    }))
  }*/

  /**
   * Returns planned tasks by given date
   */
  getPlannedTasks = (organizationName: string,
                     projectName: string,
                     date: string,
                     token: string): Promise<Array<Task>> => {
    L.i(`getPlannedTasks - date - ${date}`)
    return this.tasksRepository.getTasksByDate(
      organizationName,
      projectName,
      date,
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


  updateTask = (task: Task): Promise<Task> => {
    return this.tasksRepository.update(task);
  }

}

import TasksRepository from "../repository/tasks_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {firestore} from "firebase";
import Logger from "../util/logger";
import {Task} from "../repository/models/models";

const L = new Logger('TasksController');

export default class TasksController {

  cache: Cache;
  azureApi: AzureApi;
  tasksRepository: TasksRepository

  constructor(db: firestore.Firestore, cache: Cache, azureApi: AzureApi) {
    this.tasksRepository = new TasksRepository(db);
    this.azureApi = azureApi
    this.cache = cache
  }

  getSuggestions = async (organizationName: string,
                          projectName: string,
                          query: string,
                          token: string) => {
    L.i(`getSuggestions`)
    return this.azureApi.getTasksNew(organizationName, projectName, query, token);
  }

  planTasks = async (tasks: Array<Task>) => {
    L.i(`planTasks`)
    await this.tasksRepository.addTasks(tasks.map(t => ({...t, plannedAt: new Date().getTime()})));
  }

}

import TasksRepository from "../repository/tasks_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {firestore} from "firebase";
import Logger from "../util/logger";
import {Plan, PlanEntry, Task} from "../repository/models/models";
import moment from "moment";
import PlansRepository from "../repository/plans_repository";
import {replaceWhere} from "../util/list_util";

const L = new Logger('PlansController');

/**
 * Class for business logic related to tasks
 */
export default class PlansController {

  cache: Cache;
  azureApi: AzureApi;
  plansRepository: PlansRepository
  tasksRepository: TasksRepository

  constructor(db: firestore.Firestore,
              cache: Cache,
              azureApi: AzureApi,
              tasksRepository: TasksRepository) {
    this.plansRepository = new PlansRepository(db, azureApi, tasksRepository);
    this.tasksRepository = tasksRepository;
    this.azureApi = azureApi
    this.cache = cache
  }


  createPlan = async (plan: Plan): Promise<Plan> => {
    L.i(`createPlan`)

    // check all tasks
    // check if they are exist
    // create those tasks who not exist
    // then save plan with the given id

    await Promise.all(plan.entries.map(async (entry, index) => {
      // check if the given tasks exist
      const task = await this.tasksRepository.get(entry.taskId)
      if (!task && entry.task) {
        const savedTask = await this.tasksRepository.add(entry.task);
        const entries = plan.entries
        // update entries with just saved task id
        entries[index] = {
          ...entry,
          taskId: savedTask.id
        }

        // update plan with updated entries
        plan = {
          ...plan,
          entries
        }
      }
    }))

    return await this.plansRepository.add(plan)

  }

  /**
   * Returns nearest available plan
   */
  getPreviousNearestPlan = async (organizationName: string,
                                  projectName: string,
                                  token: string): Promise<Plan> => {

    // first take the plan
    const plan = await this.plansRepository.getPreviousPlan();

    if (!plan) {
      return null
    }

    // fill it with tasks and return
    return this.fillPlanWithTasks(plan, organizationName, projectName, token)

  }

  getPlanByDate = async (date: string,
                         organizationName: string,
                         projectName: string,
                         token: string): Promise<Plan> => {

    // first take the plan
    const plan = await this.plansRepository.getPlanByDate(date);

    if (!plan){
      return null
    }

    // fill it with tasks and return
    return this.fillPlanWithTasks(plan, organizationName, projectName, token)

  }

  fillPlanWithTasks = async (plan: Plan,
                             organizationName: string,
                             projectName: string,
                             token: string): Promise<Plan> => {

    // then fill it with the tasks
    const tasks = await this.tasksRepository.getByIds(
      plan.entries.map((entry) => entry.taskId),
      organizationName,
      projectName,
      token,
    )

    return {
      ...plan,
      entries: plan.entries.map((e) => ({
        ...e,
        task: tasks.find((t) => t.id === e.taskId)
      })),
    }

  }

  delete = async (plan: Plan) =>{
    return this.plansRepository.delete(plan.id);
  }

  stopPlanTaskForDate = async (taskId: string, date: string) => {

    const plan = await this.plansRepository.getPlanByDate(date)

    if (!plan) {
      return
    }

    await this.plansRepository.update({
      ...plan,
      entries: plan.entries.filter((e) => e.taskId === taskId)
    })

  }

  update = (plan: Plan): Promise<Plan> => {

    // todo
    // - check if the plan has new tasks - create tasks then
    // - check if all tasks id are valid
    // - check if all tasks states are valid

    return this.plansRepository.update(plan);
  }

}

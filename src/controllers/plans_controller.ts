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

        // the task only for returning from the server side.
        // not keeping it in the plans collection
        delete entries[index].task

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

  getPlanByDate = async (organizationName: string,
                         projectName: string,
                         date: string,
                         token: string): Promise<Plan> => {

    // first take the plan
    const plan = await this.plansRepository.getPlanByDate(date);

    if (!plan) {
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

  delete = async (plan: Plan) => {
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

  entriesTasksEqual = (e1: PlanEntry, e2: PlanEntry): boolean => {
    // no tasks - entries are different
    if (!e1.task || !e2.task) {
      return false;
    }

    // one task has azure id and other not - entries are different
    if ((e1.task.azureId && !e2.task.azureId) || (!e1.task.azureId && e2.task.azureId)) {
      return false;
    }

    // both has no azure ids - entries maybe the same if names are the same
    // todo in the future add here check for any other id like trelloId, asanaId
    // tasks can be taken from within other source
    // or it will be our local task. If new local task is created - we compare it simply by name
    if (!e1.task.azureId && !e2.task.azureId) {
      // if both azureId is null - it's a local task
      return e1.task.name === e2.task.name;
    }

    // otherwise compare by azure ids
    return e1.task.azureId === e2.task.azureId
  }

  update = async (plan: Plan): Promise<Plan> => {

    await Promise.all(plan.entries.map(async (e) => {

      // take only cases where we have no task id and have a task at the same time
      // that means frontend sending us a NEW task and we need to save it on backend
      // after that we need to update entry with id and save it to plan
      if (e.taskId || !e.task) {
        return
      }

      // saving the task
      const task = await this.tasksRepository.add(e.task);

      plan.entries = plan.entries.map((e1) => ({
          ...e1,
          // update task id for entry related to this task
          taskId: this.entriesTasksEqual(e, e1) ? task.id : e1.taskId
        }
      ))

    }))

    plan.entries = plan.entries.map((e) => {
      delete e.task
      return e
    })

    // todo
    // - check if the plan has new tasks - create tasks then
    // - check if all tasks id are valid
    // - check if all tasks states are valid

    return this.plansRepository.update(plan);
  }

}

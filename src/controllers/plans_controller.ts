import TasksRepository from "../repository/tasks_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {firestore} from "firebase";
import Logger from "../util/logger";
import {Plan, PlanEntry} from "../repository/models/models";
import PlansRepository from "../repository/plans_repository";
import {UnauthorizedError} from "../unauthorized_error";

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


  createPlan = async (plan: Plan, token: string): Promise<Plan> => {
    L.i(`createPlan`)

    // check all tasks
    // check if they are exist
    // create those tasks who not exist
    // then save plan with the given id

    await Promise.all(plan.entries.map(async (entry, index) => {

      // entry have no task, nothing to save
      if (!entry.task) {
        return
      }

      // check if the given tasks exist.
      const task = await this.tasksRepository.get(entry.taskId) ||
        await this.tasksRepository.getByAzureId(entry.task.azureId)

      L.i(`task found! - ${JSON.stringify(task)}`)

      let taskId: string
      if (task) {
        // task is exist - no need to create, and we will NOT update it
        // for update use `updatePlan` method
        // we just take the task id from here
        taskId = task.id
      } else {
        // otherwise let's create it
        const savedTask = await this.tasksRepository.add({
          ...entry.task,
          azureOrganizationName: plan.azureOrganizationName,
          azureProjectName: plan.azureProjectName,
        });
        taskId = savedTask.id;
      }

      plan = this.updateEntryWithTaskId(plan, index, taskId)

    }))

    L.i(`createPlan - ${JSON.stringify(plan, null, 2)}`)

    const createdPlan = await this.plansRepository.add(plan)

    return this.fillPlanWithTasks(createdPlan, /*organizationName, projectName,*/ token);

  }

  getPlan = async (organizationName: string,
                   projectName: string,
                   date: string,
                   token: string): Promise<Plan> => {

    // first take the plan
    const plan = await this.plansRepository.getPlanByParams(date, organizationName, projectName);

    if (!plan) {
      return null
    }

    // fill it with tasks and return
    return this.fillPlanWithTasks(plan, token)

  }

  getPlans = async (organizationName: string,
                    projectName: string,
                    dateFrom: string,
                    dateTo: string,
                    //userId: string,
                    token: string): Promise<Array<Plan>> => {

    L.i(`getPlans - ${dateFrom}, ${dateTo}`)

    // first take the plan
    const plans = await this.plansRepository.getPlansForDates(
      organizationName,
      projectName,
      dateFrom,
      dateTo,
    );

    // todo refactor it this way
    // UserPlans get the plans
    // every plan returned with the task that contains only the azure url and azureid
    // then frontend get task information from the azure devops server itself
    // so we DON'T fill tasks with it's info
    //
    // So every element in the frontend will ge the task data itself
    // that way we
    // 1) save the bandwidth for our server
    // 2) loading will be much more faster for the frontend

    // this is very SLOW
    return await Promise.all(plans.map(async (p) => this.fillPlanWithTasks(p, token)))

  }

  getPlansWithoutTasks = async (organizationName: string,
                                projectName: string,
                                token: string): Promise<Array<Plan>> => {

    // Yes, we check only existence of token,
    // we don't check if the token is right.
    // token usually need to fill the plan with the tasks
    // here we don't fill the plan. But we kind of don't want
    // to return plan as is (without token) and at the same time
    // we can't check the token (azure devops rest api checking it)
    //
    // so we just check if we have token. that's all.
    if (!token) {
      throw new UnauthorizedError();
    }

    return await this.plansRepository.getPlansByOrganizationAndProject(organizationName, projectName);

  }

  fillPlanWithTasks = async (plan: Plan, token: string): Promise<Plan> => {

    // then fill it with the tasks
    const tasks = await this.tasksRepository.getByIds(
      plan.entries.map((entry) => entry.taskId),
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

  update = async (plan: Plan, token: string): Promise<Plan> => {

    await Promise.all(plan.entries.map(async (e) => {

      // take only cases where we have no task id and have a task at the same time
      // that means frontend sending us a NEW task and we need to save it on backend
      // after that we need to update entry with id and save it to plan
      if (e.taskId || !e.task) {
        return
      }

      // saving the task
      const task = await this.tasksRepository.add({
        ...e.task,
        azureOrganizationName: plan.azureOrganizationName,
        azureProjectName: plan.azureProjectName,
      });

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

    if (!plan.entries.length) {
      await this.plansRepository.delete(plan.id);
      return null;
    }

    const updatedPlan = await this.plansRepository.update(plan);

    // fill it with tasks and return
    return this.fillPlanWithTasks(updatedPlan, /*organizationName, projectName,*/ token)
  }

  private updateEntryWithTaskId = (plan: Plan, entryIndex: number, taskId: string): Plan => {
    return {
      ...plan,
      entries: plan.entries.map((e, i) => ({
        ...e,
        taskId: i === entryIndex ? taskId : e.taskId,
      }))
    }

  }

}

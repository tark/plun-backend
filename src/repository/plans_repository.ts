import PlansDb from "./db/plans_db";
import Logger from "../util/logger";
import {firestore} from "firebase";
import {Plan} from "./models/models";
import AzureApi from "./api/azure_api";
import TasksRepository from "./tasks_repository";

const L = new Logger('PlansRepository');

export default class PlansRepository {

  tasksRepository: TasksRepository;
  plansDb: PlansDb;
  azureApi: AzureApi;

  constructor(db: firestore.Firestore, azureApi: AzureApi, tasksRepository: TasksRepository) {
    this.tasksRepository = tasksRepository
    this.plansDb = new PlansDb(db)
    this.azureApi = azureApi
  }

  get = (id: string): Promise<Plan> => {
    L.i(`get - ${id}`)
    if (!id) {
      return null;
    }
    return this.plansDb.getById(id);
  }

  getPlanByParams = async (date: string, organizationName: string, projectName: string): Promise<Plan> => {
    return await this.plansDb.getByParams(date, organizationName, projectName)
  }

  getPlansByOrganizationAndProject = async (organizationName: string, projectName: string): Promise<Array<Plan>> => {
    return await this.plansDb.getByOrganizationAndProject(organizationName, projectName)
  }

  getUserPlansForDates = async (organizationName: string,
                                projectName: string,
                                dateFrom: string,
                                dateTo: string,
                                userId: string) => {
    L.i(`getUserPlansForDates - ${dateFrom}, ${dateTo}`)
    return this.plansDb.getUserPlansForDates(
      organizationName,
      projectName,
      dateFrom,
      dateTo,
      userId
    )
  }

  getPlansForDates = async (organizationName: string,
                            projectName: string,
                            dateFrom: string,
                            dateTo: string) => {
    L.i(`getUserPlansForDates - ${dateFrom}, ${dateTo}`)
    return this.plansDb.getPlansForDates(
      organizationName,
      projectName,
      dateFrom,
      dateTo
    )
  }

  add = async (plan: Plan): Promise<Plan> => {
    L.i('add')
    return this.plansDb.add(plan);
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    return this.plansDb.delete(id);
  }

  update = async (plan: Plan): Promise<Plan> => {
    L.i(`update - ${JSON.stringify(plan)}`)
    return this.plansDb.update(plan);
  }

}

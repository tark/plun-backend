import PlansDb from "./db/Plans_db";
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

  getPreviousPlan = (): Promise<Plan> => {
    return this.plansDb.getPreviousPlan();
  }

  get = (id: string): Promise<Plan> => {
    L.i(`get - ${id}`)
    if (!id) {
      return null;
    }
    return this.plansDb.getById(id);
  }

  getPlanByDate = async (date: string): Promise<Plan> => {
    return await this.plansDb.getByDate(date)
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

import {firestore} from "firebase";
import {Task} from "../models/models";
import moment from "moment";
import Logger from "../../util/logger";

const L = new Logger('TasksDb');

export default class TasksDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string): Promise<Task> => {
    const doc = await this.tasks().doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToTask(doc);
  }

  getByIds = async (ids: Array<string>): Promise<Array<Task>> => {
    ids = ids.filter((id) => !!id)
    const querySnapshot = await this.tasks().where(firestore.FieldPath.documentId(), 'in', ids).get();
    return querySnapshot.docs.map(this.mapDocToTask)
  }

  getByAzureId = async (azureId: number) : Promise<Task> => {

    if (!azureId) {
      return null
    }

    const querySnapshot = await this.tasks().where('azureId', '==', azureId).get();
    if (querySnapshot.size == 0) {
      return null
    }
    return this.mapDocToTask(querySnapshot.docs[0])
  }

  getByDate = async (date: string): Promise<Array<Task>> => {
    const querySnapshot = await this.tasks().where("plannedAt", "array-contains", date).get();
    return querySnapshot.docs.map(this.mapDocToTask)
  }

  /**
   * Returns list of tasks for the nearest day before that have at least one task
   *
   * @deprecated
   */
  getPreviousNearestTasks = async (): Promise<Array<Task>> => {
    L.i(`getPreviousNearestTasks`)
    const now = moment().format('YYYY-MM-DD');

    // todo: in the future don't get ALL tasks
    // find a way we can find previous nearest task more
    // cheap way
    //
    // get all tasks
    const query = await this.tasks().get();

    // exit if no tasks
    if (query.empty) {
      return [];
    }

    // convert tasks to tasks model
    const tasks = query.docs.map(this.mapDocToTask)

    // first take all the dates
    //let allDates : Array<string> = tasks.reduce((acc, e) => acc.concat(e.plannedAt), []).sort();
    let allDates : Array<string> = [];
    allDates.push(now);
    allDates.sort();
    // dedupe for the case some task has "now" date
    allDates = [...new Set(allDates)]


    L.i(`getPreviousNearestTasks - allDates - ${allDates}`)

    // if allDates was empty before we add now, or if now is the smallest date
    if (allDates.length == 1 || allDates.indexOf(now) == 0) {
      return [];
    }

    // get the date

    // needed date is pre nearest before now, because it's sorted
    const date : string = allDates[allDates.indexOf(now) - 1];

    //get all tasks by this date
    return this.getByDate(date);
  }

  /*getByName = async (name: string) => {
    return this.tasks().where("name", ">", name)
  }*/

  add = async (task: Task): Promise<Task> => {
    L.i(`add - ${task.azureId}`)

    // first check if such a task already exist
    // azure id field should be unique
    // dont add task is the task with the same azure id already exists
    const existingTask = await this.getByAzureId(task.azureId)
    if (existingTask) {
      return existingTask;
    }

    delete task.id
    const ref = await this.tasks().add(task)
    const doc = await ref.get();
    return this.mapDocToTask(doc);
  }

  delete = (id: string) => {
    return this.tasks().doc(id).delete()
  }

  update = async (task: Task): Promise<Task> => {
    const ref = this.tasks().doc(task.id);
    await ref.update(task);
    return this.getById(task.id);
  }

  tasks = (): firestore.CollectionReference => {
    return this.db.collection('tasks');
  }

  mapDocToTask = (doc: firestore.DocumentSnapshot): Task => {
    const {azureId, azureUrl, azureState, name, azureOrganizationName, azureProjectName} = doc.data()
    return {
      id: doc.id,
      name,
      azureId,
      azureUrl,
      azureState,
      azureOrganizationName,
      azureProjectName,
    };
  }

}

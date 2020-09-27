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

  getByDate = async (date: number): Promise<Array<Task>> => {
    const querySnapshot = await this.tasks().where("plannedAt", "==", date).get();
    const tasks = new Array<Task>()
    querySnapshot.forEach((doc) => {
      tasks.push(this.mapDocToTask(doc))
    });
    return tasks;
  }

  /**
   * Returns list of tasks for the nearest day before that have at least one task
   */
  getPreviousNearestTasks = async (): Promise<Array<Task>> => {
    L.i(`getForNearestDate`)
    const now = moment().valueOf();

    // get the nearest task
    const querySnapshot = await this.tasks()
      .where("plannedAt", "<", now)
      .orderBy("plannedAt", 'desc')
      .limit(1)
      .get();

    if (querySnapshot.empty){
      return [];
    }

    // get the date
    const date = querySnapshot.docs[0].data()['plannedAt'];

    //get all tasks by this date
    return this.getByDate(date);
  }

  /*getByName = async (name: string) => {
    return this.tasks().where("name", ">", name)
  }*/

  add = async (task: Task): Promise<Task> => {
    const ref = await this.tasks().add(task)
    const doc = await ref.get();
    return this.mapDocToTask(doc);
  }

  addTasks = async (tasks: Array<Task>): Promise<boolean> => {
    await Promise.all(tasks.map(async t => {
      const tasksWithSameAzureId = await this.tasks().where("azureId", "==", t.azureId ?? '').get()
      if (tasksWithSameAzureId.empty) {
        await this.tasks().add(t)
      }
    }))
    return true;
  }

  delete = (id: string) => {
    return this.tasks().doc(id).delete()
  }

  update = async (task: Task) : Promise<Task> => {
    const ref = this.tasks().doc(task.id);
    await ref.update(task);
    return this.getById(task.id);
  }

  tasks = (): firestore.CollectionReference => {
    return this.db.collection('tasks');
  }

  mapDocToTask = (doc: firestore.DocumentSnapshot): Task => {
    const {azureId, azureUrl, azureState, name, state, plannedAt} = doc.data()
    return {
      id: doc.id,
      name,
      state,
      plannedAt,
      azureId,
      azureUrl,
      azureState,
    };
  }

}

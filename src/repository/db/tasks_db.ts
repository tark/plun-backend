import {firestore} from "firebase";
import {Task} from "../models/models";

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
      await this.tasks().add(t)
    }))
    return true;
  }

  delete = async (id: string) => {
    const task = await this.getById(id);
    //await task.delete();
  }

  tasks = (): firestore.CollectionReference => {
    return this.db.collection('tasks');
  }

  mapDocToTask = (doc: firestore.DocumentSnapshot): Task => {
    const {azureId, azureName, azureUrl, azureState, name, state, plannedAt} = doc.data()
    return {
      id: doc.id,
      name,
      state,
      plannedAt,
      azureId,
      azureName,
      azureUrl,
      azureState,
    };
  }

}

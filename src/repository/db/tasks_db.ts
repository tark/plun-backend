import {firestore} from "firebase";

export default class TasksDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string) => {
    const doc = await this.tasks().doc(id).get();
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      }
    }
    return null;
  }

  /*getByName = async (name: string) => {
    return this.tasks().where("name", ">", name)
  }

  add = async (task: Task) : Promise<Task> => {
    return this.tasks().add(task)
  }*/

  delete = async (id: string) => {
    const task = await this.getById(id);
    //await task.delete();
  }

  tasks = (): firestore.CollectionReference => {
    return this.db.collection('tasks');
  }

}

export default class TasksDb {

  constructor(db) {
    this.db = db
  }

  getById = async (id) => {
    const doc = await this.tasks().doc(id).get();
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      }
    }
    return null;
  }

  getByName = async (name) => {
    return this.tasks().where("name", ">", name)
  }

  add = async (task) => {
    await this.tasks().add(task)
  }

  delete = async (id) => {
    const task = await this.getById(id);
    await task.delete();
  }

  tasks = () => {
    return this.db.collection('tasks');
  }

}

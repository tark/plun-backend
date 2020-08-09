import Logger from "../../util/logger.js";

const L = new Logger('UserDb');

export default class UsersDb {

  constructor(db) {
    this.db = db
  }

  getById = async (id) => {
    L.i(`getById - ${id}`)
    const doc = await this.users().doc(id).get();
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    return null;
  }

  getByAzureProfileId = async (azureProfileId) => {
    L.i(`getByAzureProfileId - ${azureProfileId}`)
    const result = await this.users().where("azureProfileId", "==", azureProfileId).get()

    if (!result.docs || !result.docs.length) {
      return null
    }

    return {
      id: result.docs[0].id,
      ...result.docs[0].data()
    };
  }

  add = async (user) => {
    L.i(`add - ${user.email}`)
    const docRef = await this.users().add(user)
    const snapshot = await docRef.get()
    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  delete = async (id) => {
    L.i(`delete - ${id}`)
    const user = await this.users().doc(id).get();
    if (user.exists) {
      await user.delete()
    }
  }

  users = () => {
    return this.db.collection('users');
  }

}

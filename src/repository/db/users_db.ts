import Logger from "../../util/logger";
import {firestore} from "firebase";
import {User} from "../models/models";

const L = new Logger('UserDb');

export default class UsersDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string) => {
    L.i(`getById - ${id}`)
    const doc = await this.users().doc(id).get();
    if (doc.exists) {
      const {azureProfileId, name, email} =  doc.data()
      return {
        id: doc.id,
        azureProfileId,
        name,
        email
      };
    }
    return null;
  }

  getByAzureProfileId = async (azureProfileId: string): Promise<User> => {
    L.i(`getByAzureProfileId - ${azureProfileId}`)
    const result = await this.users().where("azureProfileId", "==", azureProfileId).get()

    if (!result.docs || !result.docs.length) {
      return null
    }

    const {name, email} = result.docs[0].data()

    return {
      id: result.docs[0].id,
      azureProfileId,
      name,
      email
    };
  }

  add = async (user: User) : Promise<User> => {
    L.i(`add - ${user.email}`)
    const docRef = await this.users().add(user)
    const snapshot = await docRef.get()
    const {azureProfileId, name, email} = snapshot.data()
    return {
      id: snapshot.id,
      azureProfileId,
      name,
      email,
    };
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    const user = await this.users().doc(id).get();
    if (user.exists) {
      //await user.delete()
    }
  }

  users = () => {
    return this.db.collection('users');
  }

}

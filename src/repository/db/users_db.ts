import Logger from "../../util/logger";
import {firestore} from "firebase";
import { User} from "../models/models";

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
    L.i(`add - ${JSON.stringify(user.email)}`)

    const existingUser = this.getByAzureProfileId(user.azureProfileId)
    if (existingUser){
      return;
    }

    const docRef = await this.users().add(this.prepareForInternalSave(user))
    const snapshot = await docRef.get()
    const {azureProfileId, name, email} = snapshot.data()
    return {
      id: snapshot.id,
      azureProfileId,
      name,
      email,
    };
  }

  update = async (user: User) : Promise<User> => {
    L.i(`update - ${JSON.stringify(user)}`)
    const doc = this.users().doc(user.id);
    await doc.update({
      email: user.email,
      name: user.name,
    })
    const snapshot = await doc.get()
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


  private prepareForInternalSave = (user: User): User => {
    delete user.id
    return user
  }

}

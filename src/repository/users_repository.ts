import UsersDb from "./db/users_db";
import Logger from "../util/logger";
import {firestore} from "firebase";
import {User} from "./models/models";

const L = new Logger('UsersRepository');

export default class UsersRepository {

  usersDb: UsersDb;

  constructor(db: firestore.Firestore) {
    this.usersDb = new UsersDb(db)
  }

  get = (id: string) : Promise<User>=> {
    L.i(`get - ${id}`)
    return this.usersDb.getById(id);
  }

  getByAzureProfileId = (azureProfileId: string) : Promise<User>=> {
    L.i(`getByAzureProfileId - ${azureProfileId}`)
    return this.usersDb.getByAzureProfileId(azureProfileId);
  }

  add = async (user : User) : Promise<User>=> {
    L.i(`add - ${user}`)
    return this.usersDb.add(user);
  }

  delete = async (id : string) => {
    L.i(`delete - ${id}`)
    return this.usersDb.delete(id);
  }

}

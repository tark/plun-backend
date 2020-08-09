import UsersDb from "./db/users_db.js";
import Logger from "../util/logger.js";

const L = new Logger('UsersRepository');

export default class UsersRepository {

  constructor(db) {
    this.usersDb = new UsersDb(db)
  }

  get = (id) => {
    L.i(`get - ${id}`)
    return this.usersDb.getById(id);
  }

  getByAzureProfileId = (azureProfileId) => {
    L.i(`getByAzureProfileId - ${azureProfileId}`)
    return this.usersDb.getByAzureProfileId(azureProfileId);
  }

  add = async (user) => {
    L.i(`add - ${user}`)
    return this.usersDb.add(user);
  }

  delete = async (id) => {
    L.i(`delete - ${id}`)
    return this.usersDb.delete(id);
  }

}

import UsersDb from "./db/users_db";
import Logger from "../util/logger";
import {firestore} from "firebase";
import {AzureProfile, User} from "./models/models";

const L = new Logger('UsersRepository');

export default class UsersRepository {

  usersDb: UsersDb;

  constructor(db: firestore.Firestore) {
    this.usersDb = new UsersDb(db)
  }

  get = (id: string): Promise<User> => {
    L.i(`get - ${id}`)
    return this.usersDb.getById(id);
  }

  getByAzureProfileId = (azureProfileId: string): Promise<User> => {
    L.i(`getByAzureProfileId - ${azureProfileId}`)
    return this.usersDb.getByAzureProfileId(azureProfileId);
  }

  getByEmail = (email: string): Promise<User> => {
    L.i(`getByEmail - ${email}`)
    return this.usersDb.getByEmail(email)
  }

  add = async (user: User): Promise<User> => {
    L.i(`add - ${user}`)
    return this.usersDb.add(user);
  }

  addOrUpdateByAzureId = async (azureProfile: AzureProfile): Promise<User> => {
    L.i(`addOrUpdateByAzureId - ${azureProfile.emailAddress}`)
    const userFromDb = await this.getByAzureProfileId(azureProfile.id)
    if (!userFromDb) {
      return this.usersDb.add(this.userFromAzureProfile(azureProfile));
    } else {
      return this.usersDb.update(userFromDb);
    }
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    return this.usersDb.delete(id);
  }

  userFromAzureProfile = (azureProfile: AzureProfile) : User => {
    const {emailAddress, displayName, id} = azureProfile
    return {
      id: '',
      azureProfileId: id,
      name: displayName,
      email: emailAddress,
    };
  }

}

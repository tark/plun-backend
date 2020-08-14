import OrganizationsDb from "./db/organizations_db";
import Logger from "../util/logger";
import {Organization} from "./models/models";
import {firestore} from "firebase";

const L = new Logger('OrganizationsRepository');

export default class OrganizationsRepository {

  db: firestore.Firestore;
  organizationsDb: OrganizationsDb;

  constructor(db: firestore.Firestore) {
    this.organizationsDb = new OrganizationsDb(db)
  }

  get = (id: string) : Promise<Organization>=> {
    L.i(`get - ${id}`)
    return this.organizationsDb.getById(id);
  }

  getByAzureId = (azureId : string) => {
    L.i(`getByAzureId - ${azureId}`)
    return this.organizationsDb.getByAzureId(azureId);
  }

  add = async (organization : Organization) => {
    L.i(`add - ${organization.name}`)
    return this.organizationsDb.add(organization);
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    return this.organizationsDb.delete(id);
  }

  updateOrganizations = async (organizations: Array<Organization>): Promise<Array<Organization>> => {
    L.i(`updateOrganizations - ${organizations}`)
    const savedOrganizations = new Array<Organization>();
    for (const o of organizations) {
      savedOrganizations.push(await this.organizationsDb.addOrUpdate(o));
    }
    return savedOrganizations;
  }


}

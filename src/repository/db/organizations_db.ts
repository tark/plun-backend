import Logger from "../../util/logger";
import {firestore} from "firebase";
import {Organization} from "../models/models";

const L = new Logger('OrganizationsDb');

export default class OrganizationsDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string): Promise<Organization> => {
    const doc = await this.organizations().doc(id).get();
    if (doc.exists) {
      const {azureId, name} = doc.data();
      return {
        id: doc.id,
        azureId,
        name,
      }
    }
    return null;
  }

  getByAzureId = async (azureId: string): Promise<Organization> => {
    L.i(`getByAzureId - ${azureId}`)
    const result = await this.organizations().where("azureId", "==", azureId).get()

    if (!result.docs || !result.docs.length) {
      return null
    }

    L.i(`getByAzureId - ${result.docs[0]}`)

    return {
      id: result.docs[0].id,
      azureId,
      name: result.docs[0].data().name,
    }

  }

  add = async (organization : Organization): Promise<Organization> => {
    L.i(`add - ${organization.name}`)

    const existingOrganization = await this.getByAzureId(organization.azureId)

    if (existingOrganization) {
      return existingOrganization;
    }

    const docRef = await this.organizations().add(organization)
    const snapshot = await docRef.get()

    const {azureId, name} = snapshot.data();

    return {
      id: snapshot.id,
      azureId,
      name
    };
  }

  addOrUpdate = async (organization: Organization): Promise<Organization> => {
    let org = await this.getByAzureId(organization.azureId);

    // if there is no such - add and return it
    if (!org) {
      return this.add(organization);
    }

    // if there IS such - update it
    await this.organizations().doc(org.id).update(organization);

    // after update take updated data from db and return
    return await this.getByAzureId(organization.azureId);

  }

  delete = async (id: string) => {
    const doc = this.organizations().doc(id);
    const snapshot = await doc.get();
    if (snapshot.exists) {
      await doc.delete();
    }
  }

  organizations = (): firestore.CollectionReference => {
    return this.db.collection('organizations');
  }

}

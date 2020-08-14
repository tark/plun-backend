import Logger from "../../util/logger";
import {firestore} from "firebase";
import {Organization, Project} from "../models/models";

const L = new Logger('ProjectsDb');

export default class ProjectsDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string): Promise<Project> => {
    L.i(`getById`)
    const doc = await this.projects().doc(id).get();
    const {azureId, name} = doc.data();
    if (doc.exists) {
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

    const result = await this.projects().where("azureId", "==", azureId).get()

    if (!result.docs || !result.docs.length) {
      return null
    }

    return {
      id: result.docs[0].id,
      azureId,
      name: result.docs[0].data().name,
    };
  }

  add = async (project: Project) : Promise<Project>=> {
    L.i(`add - ${project.name}`)

    const existingOrganization = await this.getByAzureId(project.azureId)

    if (existingOrganization) {
      return existingOrganization;
    }

    const docRef = await this.projects().add(project)
    const snapshot = await docRef.get()

    const {azureId, name} = snapshot.data();
    return {
      id: snapshot.id,
      azureId,
      name
    };
  }

  addOrUpdate = async (project: Project): Promise<Project> => {
    L.i(`addOrUpdate`)
    let projectFromApi = await this.getByAzureId(project.azureId);

    // if there is no such - add and return it
    if (!projectFromApi) {
      return this.add(project);
    }

    // if there IS such - update it
    await this.projects().doc(projectFromApi.id).update(project);

    // after update take updated data from db and return
    return await this.getByAzureId(project.azureId);

  }

  delete = async (id: string) => {
    L.i(`delete`)
    const doc = this.projects().doc(id);
    const snapshot = await doc.get();
    if (snapshot.exists) {
      await doc.delete();
    }
  }

  projects = (): firestore.CollectionReference => {
    return this.db.collection('projects');
  }

}

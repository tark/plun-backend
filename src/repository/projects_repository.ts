import ProjectsDb from "./db/projects_db";
import Logger from "../util/logger";
import {Project} from "./models/models";
import {firestore} from "firebase";

const L = new Logger('ProjectsRepository');

export default class ProjectsRepository {
  projectsDb: ProjectsDb;

  constructor(db: firestore.Firestore) {
    this.projectsDb = new ProjectsDb(db)
  }

  get = (id: string): Promise<Project> => {
    L.i(`get - ${id}`)
    return this.projectsDb.getById(id);
  }

  getByAzureId = (azureId: string): Promise<Project> => {
    L.i(`getByAzureId - ${azureId}`)
    return this.projectsDb.getByAzureId(azureId);
  }

  add = async (project: Project): Promise<Project> => {
    L.i(`add - ${project.name}`)
    return this.projectsDb.add(project);
  }

  delete = async (id: string) => {
    L.i(`delete - ${id}`)
    return this.projectsDb.delete(id);
  }

  updateProjects = async (projects: Array<Project>): Promise<Array<Project>> => {
    const savedProjects = new Array<Project>();
    for (const p of projects) {
      savedProjects.push(await this.projectsDb.addOrUpdate(p));
    }
    return savedProjects;
  }

}

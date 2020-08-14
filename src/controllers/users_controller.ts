import {UnauthorizedError} from "../unauthorized_error";
import Logger from "../util/logger";
import UsersRepository from "../repository/users_repository";
import OrganizationsRepository from "../repository/organizations_repository";
import ProjectsRepository from "../repository/projects_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {User} from "../repository/models/models";
import {firestore} from "firebase";

const L = new Logger('UsersController');

export default class UsersController {

  cache: Cache;
  usersRepository: UsersRepository;
  organizationsRepository: OrganizationsRepository;
  projectsRepository: ProjectsRepository;
  azureApi: AzureApi;

  constructor(db: firestore.Firestore, cache : Cache, azureApi: AzureApi) {

    this.cache = cache;
    this.usersRepository = new UsersRepository(db);
    this.organizationsRepository = new OrganizationsRepository(db);
    this.projectsRepository = new ProjectsRepository(db);
    this.azureApi = azureApi;
  }

  auth = async (userId : string) => {
    L.i(`auth - ${userId}`);
    const token = this.cache.getToken(userId);

    // check if token is here
    if (!token) {
      L.i(`auth - error`)
      throw new UnauthorizedError()
    }

    // check if token not expired by trying to call an api
    // todo in the future check the access token expired time
    // we can save it once received and then check
    try {
      return await this.initUser(token);
    } catch (e) {
      throw new UnauthorizedError()
    }
  }

  /**
   * This function used when we have no access token or the token is expired
   * We are using the given authorization code to get the access token.
   * More details here
   * https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth
   */
  authByCode = async (authCode: string) => {
    L.i(`authByCode`)

    const token = await this.azureApi.getAccessToken(authCode);

    const savedUser = await this.initUser(token);

    this.cache.setToken(savedUser.id, token)

    return savedUser;

  }

  initUser = async (token: string) => {
    L.i(`initUser`)
    const azureProfile = await this.azureApi.getProfile(token);
    const {displayName, emailAddress, id} = azureProfile

    let savedUser : User = await this.usersRepository.getByAzureProfileId(id);
    if (!savedUser) {
      savedUser = await this.usersRepository.add({
        id: savedUser.id,
        azureProfileId: id,
        name: displayName,
        email: emailAddress,
      })
    }

    // save organizations to user
    let organizations = await this.azureApi.getOrganizations(token);
    organizations = await this.organizationsRepository.updateOrganizations(organizations);
    savedUser.organizations = organizations.map(o => o.id);

    await Promise.all(organizations.map(async (o) => {
      // save organizations to user
      let projects = await this.azureApi.getProjects(o.name, token);
      projects = await this.projectsRepository.updateProjects(projects);
      o.projects = projects.map(p => p.id);
      await this.organizationsRepository.updateOrganizations([o]);
    }))

    return savedUser;
  }

}

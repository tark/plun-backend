import {UnauthorizedError} from "../unauthorized_error";
import Logger from "../util/logger";
import UsersRepository from "../repository/users_repository";
import OrganizationsRepository from "../repository/organizations_repository";
import ProjectsRepository from "../repository/projects_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {Organization, Project, User} from "../repository/models/models";
import {firestore} from "firebase";

const L = new Logger('UsersController');

export default class UsersController {

  cache: Cache;
  usersRepository: UsersRepository;
  organizationsRepository: OrganizationsRepository;
  projectsRepository: ProjectsRepository;
  azureApi: AzureApi;

  constructor(db: firestore.Firestore, cache: Cache, azureApi: AzureApi) {

    this.cache = cache;
    this.usersRepository = new UsersRepository(db);
    this.organizationsRepository = new OrganizationsRepository(db);
    this.projectsRepository = new ProjectsRepository(db);
    this.azureApi = azureApi;
  }

  /**
   *
   * Not using this. We are not auth by user id anymore,
   * use token for this.
   *
   * @deprecated
   * @param userId
   */
  auth = async (userId: string) => {
    L.i(`auth - ${userId}`);
    const token = this.getTokenFromCache(userId);

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

  getAccessToken = async (authCode: string) => {
    return this.azureApi.getAccessToken(authCode);
  }

  getProfile = async (token: string) : Promise<User> => {
    this.checkToken(token)
    const azureProfile = await this.azureApi.getProfile(token)
    const {displayName, emailAddress, id} = azureProfile
    return {
      id: '',
      azureProfileId: id,
      name: displayName,
      email: emailAddress,
    }
  }

  /**
   * Return user from azure api, save it to DB if need to
   * Also take all orgs and projects of this user, save to db if need to
   * I am not really sure if we need to save the user, orgs and projects to DB
   * maybe we can to save only tasks?
   * @param token
   */
  initUser = async (token: string) => {
    L.i(`initUser`)
    const azureProfile = await this.azureApi.getProfile(token);
    const {displayName, emailAddress, id} = azureProfile

    let savedUser: User = await this.usersRepository.getByAzureProfileId(id);
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

  getOrganizations = async (token: string) : Promise<Array<Organization>> => {
    L.i(`getOrganizations`)
    this.checkToken(token)
    return this.azureApi.getOrganizations(token);
  }

  getProjects = async (organizationName: string, token: string) : Promise<Array<Project>> => {
    L.i(`getProjects - ${organizationName}`)
    this.checkToken(token)
    return this.azureApi.getProjects(organizationName, token);
  }

  /**
   * Will keep token on a client side, no need to keep it here
   * @deprecated
   * @param userId
   */
  getTokenFromCache = (userId: string): string => {
    const token = this.cache.getToken(userId);

    // check if token is here
    if (!token) {
      L.i(`auth - error`)
      throw new UnauthorizedError()
    }

    return token
  }

  checkToken = (token: string) => {
    if (!token){
      throw new UnauthorizedError();
    }
  }

}

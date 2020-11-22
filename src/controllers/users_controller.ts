import {UnauthorizedError} from "../unauthorized_error";
import Logger from "../util/logger";
import UsersRepository from "../repository/users_repository";
import OrganizationsRepository from "../repository/organizations_repository";
import ProjectsRepository from "../repository/projects_repository";
import AzureApi from "../repository/api/azure_api";
import Cache from "../repository/cache";
import {AzureAuthResponse, Organization, Project, User} from "../repository/models/models";
import {firestore} from "firebase";
import PlansController from "./plans_controller";

const L = new Logger('UsersController');

export default class UsersController {

  cache: Cache;
  usersRepository: UsersRepository;
  organizationsRepository: OrganizationsRepository;
  projectsRepository: ProjectsRepository;
  plansController: PlansController;
  azureApi: AzureApi;

  constructor(db: firestore.Firestore,
              cache: Cache,
              azureApi: AzureApi,
              plansController: PlansController) {

    this.cache = cache;
    this.usersRepository = new UsersRepository(db);
    this.organizationsRepository = new OrganizationsRepository(db);
    this.projectsRepository = new ProjectsRepository(db);
    this.azureApi = azureApi;
    this.plansController = plansController;
  }

  refreshToken = async (refreshToken: string): Promise<AzureAuthResponse> => {
    return this.azureApi.refreshToken(refreshToken);
  }

  /**
   * Auth by given code and create a user
   * if this user was not created before
   *
   * This function used when we have no access token or the token is expired
   * We are using the given authorization code to get the access token.
   * More details here
   * https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth
   *
   * @return Promise<AzureAuthResponse>
   */
  authByCode = async (authCode: string): Promise<AzureAuthResponse> => {
    L.i(`authByCode - ${authCode}`)

    const authResponse = await this.azureApi.auth(authCode);

    const azureProfile = await this.azureApi.getProfile(authResponse.accessToken)

    const {emailAddress, displayName, id} = azureProfile

    let savedUser: User = await this.usersRepository.getByAzureProfileId(id);
    if (!savedUser) {
      // save user if we don't have one
      await this.usersRepository.add({
        id: savedUser.id,
        azureProfileId: id,
        name: displayName,
        email: emailAddress,
      })
    }

    return authResponse;

  }

  /*getAccessToken = async (authCode: string) => {
    return this.azureApi.getAccessToken(authCode);
  }*/

  getProfile = async (token: string): Promise<User> => {
    const azureProfile = await this.azureApi.getProfile(token)
    return this.usersRepository.addOrUpdateByAzureId(azureProfile);
  }

  /**
   * Return user from azure api, save it to DB if need to
   * Also take all orgs and projects of this user, save to db if need to
   * I am not really sure if we need to save the user, orgs and projects to DB
   * maybe we can to save only tasks?
   * @param token
   *
   * Let's not do so much work at start.
   * Let's only return a user and let other components ask for organizations ' projects themselv
   *
   * @deprecated
   *
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

  getOrganizations = async (token: string): Promise<Array<Organization>> => {
    L.i(`getOrganizations`)
    this.checkToken(token)
    return this.azureApi.getOrganizations(token);
  }

  getProjects = async (organizationName: string, token: string): Promise<Array<Project>> => {
    L.i(`getProjects - ${organizationName}`)
    this.checkToken(token)
    return this.azureApi.getProjects(organizationName, token);
  }

  /**
   * Return all users who have plans inside that Org/Proj
   */
  getUsers = async (organizationName: string,
                    projectName: string,
                    token: string): Promise<Array<User>> => {
    L.i(`getUsers - ${organizationName}, ${projectName}`)
    // get the plans
    const plans = await this.plansController.getPlansWithoutTasks(organizationName, projectName, token)

    // calculate user ids without dupes
    const userIds = [...new Set(plans.map(p => p.userId))];

    // get user for every user ids
    return Promise.all(userIds.map(async (id) => this.usersRepository.get(id)))
  }

  checkToken = (token: string) => {
    if (!token) {
      throw new UnauthorizedError();
    }
  }

}

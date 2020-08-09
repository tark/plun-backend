import {UnauthorizedError} from "../unauthorized_error.js";
import Logger from "../util/logger.js";

const L = new Logger('UsersController');

export default class UsersController {

  constructor(cache, usersRepository, azureApi) {
    this.cache = cache;
    this.usersRepository = usersRepository;
    this.azureApi = azureApi;
  }

  auth = async (userId) => {
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
      const azureProfile = await this.azureApi.getProfile(token);
      const {displayName, emailAddress, id} = azureProfile
      const savedUser = await this.usersRepository.add({
        azureProfileId: id,
        name: displayName,
        email: emailAddress,
      })
      return savedUser;
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
  authByCode = async (authCode) => {
    L.i(`authByCode - ${authCode}`)

    const token = await this.azureApi.getAccessToken(authCode);
    const azureProfile = await this.azureApi.getProfile(token);
    const {displayName, emailAddress, id} = azureProfile

    let savedUser = await this.usersRepository.getByAzureProfileId(id);
    if (!savedUser) {
      savedUser = await this.usersRepository.add({
        azureProfileId: id,
        name: displayName,
        email: emailAddress,
      })
    }

    this.cache.setToken(savedUser.id, token)

    return savedUser;

  }

}

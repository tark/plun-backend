import NodeCache from "node-cache";
import {UnauthorizedError} from "../../unauthorized_error.js";
import axios from "axios";
import qs from "qs";
import Logger from "../../util/logger.js";

const L = new Logger('AzureApi');
const baseApiUrl = 'https://app.vssps.visualstudio.com'
const baseApiUrlAzure = 'https://dev.azure.com'
const Endpoints = {
  token: `${baseApiUrl}/oauth2/token`,
  accounts: `${baseApiUrl}/_apis/accounts`,
  profile: `${baseApiUrl}/_apis/profile/profiles/me`,
}

const callbackUrl = 'https://dev.plun.io:3000/azure-auth-callback'

export default class AzureApi {

  constructor(cache) {
    this.cache = cache;
  }

  /**
   * Retrieve the azure token by the given authorization code
   */
  getAccessToken = async (authCode) => {
    L.i(`getAccessToken - ${authCode}`)
    try {
      const result = await axios.post(
        Endpoints.token,
        qs.stringify({
          'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          'client_assertion': encodeURI(process.env.AZURE_CLIENT_SECRET),
          'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          'assertion': encodeURI(authCode),
          'redirect_uri': callbackUrl,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        },
      );

      return result.data.access_token
    } catch (e) {
      L.i(`getAccessToken - ${e}`)
      throw e;
    }
  }

  /**
   * Refreshes the auth azure token by using the refresh token from the memory
   */
  refreshToken = async () => {
    L.i(`refreshToken`)
    const refreshToken = new NodeCache().get('refresh_token');

    if (!refreshToken) {
      return;
    }

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    }

    const data = {
      'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      'client_assertion': encodeURI(clientSecret),
      'grant_type': 'refresh_token',
      'assertion': encodeURI(refreshToken),
      'redirect_uri': callbackUrl,
    }

    const result = await axios.post(url, qs.stringify(data), config);

  }

  /**
   * Returns first 20 tasks suits the given query
   */
  getTasks = async (query) => {
    L.i(`getTasks - ${query}`)
    try {
      const organization = this.getOrganization();
      const projectId = this.getProjectId();
      const teamId = this.getTeamId();

      L.i(`getTasks - ${baseApiUrlAzure}/${organization}/${projectId}/${teamId}/_apis/wit/wiql`)

      const result = await axios.post(
        `${baseApiUrlAzure}/${organization}/${projectId}/${teamId}/_apis/wit/wiql`,
        {query: `SELECT * FROM WorkItems WHERE [Title] CONTAINS '${query}'`},
        this.apiConfig()
      );

      L.i(`getTasks - ${JSON.stringify(result.data, null, 2)}`)

      const ids = result.data.workItems.map(i => i.id)

      // GET https://dev.azure.com/{organization}/{project}/_apis/wit/workitems?ids={ids}&api-version=5.1

      const result1 = await axios.get(
        `${baseApiUrlAzure}/${organization}/${projectId}/_apis/wit/workitems`,
        //{query: `SELECT * FROM WorkItems WHERE [Title] CONTAINS '${query}'`},
        this.apiConfig(
          {
            ids: ids.join(','),
            fields: 'System.Title',
          }
        )
      );

      L.i(`getTasks - ${JSON.stringify(result1.data, null, 2)}`)


      // get from wiql list of tasks with ids only
      // get from tasks list by ids

    } catch (e) {
      L.i(`getTasks - ${e}`)
    }

  }

  /**
   * Returns the current user based on current auth token
   */
  getProfile = async (token) => {
    L.i(`getProfile`)
    try {
      const result = await axios.get(Endpoints.profile, {headers: this.authHeader(token)});
      L.i(`getProfile - ${JSON.stringify(result.data, null, 2)}`)
      return result.data;
    } catch (e) {
      L.i(`getProfile - error - ${e}`)
      return null;
    }

  }

  getProjects = async () => {
    L.i(`getProjects`)
    try {
      const organization = this.getOrganization();
      L.i(`getProjects - endpoint - ${baseApiUrlAzure}/${organization}/_apis/projects`)
      const result = await axios.get(`${baseApiUrlAzure}/${organization}/_apis/projects`, this.apiConfig());
      this.setProjectId(result.data.value[0].id)
    } catch (e) {
      L.i(`getProjects - ${e}`)
    }
  }

  getTeams = async () => {
    L.i(`getTeams`)
    try {
      const organization = this.getOrganization();
      const projectId = this.getProjectId();
      const result = await axios.get(`${baseApiUrlAzure}/${organization}/_apis/projects/${projectId}/teams`, this.apiConfig());

      L.i(`getTeams - ${JSON.stringify(result.data, null, 2)}`)
      this.setTeamId(result.data.value[0].id)
      //this.cache.set('team_id', result.data.value[0].id)
    } catch (e) {
      L.i(`getTeams - ${e}`)
    }
  }

  apiConfig = (userId, params) => {
    return {
      headers: {
        'Authorization': `Bearer ${this.accessToken(userId)}`,
      },
      params: {
        ...params,
        'api-version': '5.1',
      },
    }
  }

  apiConfigTokenOnly = (userId) => {
    return {
      headers: {
        'Authorization': `Bearer ${this.accessToken(userId)}`,
      },
    }
  }

  accessToken = (userId) => {
    const token = this.cache.getToken(userId)
    L.i(`accessToken - ${token}`)
    if (!token) {
      throw new UnauthorizedError()
    }
    return token
  }

  authHeader = (token) => {
    return {
      'Authorization': `Bearer ${token}`,
    }
  }

}

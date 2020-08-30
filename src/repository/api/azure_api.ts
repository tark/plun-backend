import {UnauthorizedError} from "../../unauthorized_error";
import axios from "axios";
import qs from "qs";
import Logger from "../../util/logger";
import Cache from "../cache";
import {Organization, Project, Task} from "../models/models";

const L = new Logger('AzureApi');
const baseUrl = 'https://app.vssps.visualstudio.com'
const baseUrlDevAzure = 'https://dev.azure.com'
const Endpoints = {
  token: `${baseUrl}/oauth2/token`,
  accounts: `${baseUrl}/_apis/accounts`,
  profile: `${baseUrl}/_apis/profile/profiles/me`,
  projects: `${baseUrl}/_apis/projects`,
}

const callbackUrl = 'https://dev.plun.io:3000/azure-auth-callback'

export default class AzureApi {

  cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  /**
   * Retrieve the azure token by the given authorization code
   */
  getAccessToken = async (authCode: string) => {
    L.i(`getAccessToken`)
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
    const refreshToken = this.cache.get('refresh_token');

    if (!refreshToken) {
      return;
    }

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    }

    // todo implement it
    /*const data = {
      'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      'client_assertion': encodeURI(clientSecret),
      'grant_type': 'refresh_token',
      'assertion': encodeURI(refreshToken),
      'redirect_uri': callbackUrl,
    }

    const result = await axios.post(url, qs.stringify(data), config);*/

  }

  /**
   * Use this
   * https://docs.microsoft.com/en-us/rest/api/azure/devops/search/work%20item%20search%20results/fetch%20work%20item%20search%20results?view=azure-devops-rest-6.0#workitemresult
   */
  getTasksNew = async (organizationName: string,
                       projectName: string,
                       query: string,
                       token: string): Promise<Array<Task>> => {

    if (!organizationName || !projectName || !query) {
      return []
    }

    if (!token) {
      throw new UnauthorizedError();
    }

    const result = await axios.post(
      `https://almsearch.dev.azure.com/${organizationName}/${projectName}/_apis/search/workitemsearchresults?api-version=6.0-preview.1`,
      {
        'searchText': `${query}*`,
        '$skip': 0,
        '$top': 5,
        '$orderBy': [
          {
            'field': 'system.title',
            'sortOrder': 'ASC'
          }
        ],
        'includeFacets': true
      }
      ,
      this.config(token)
    );

    if (result.data == null || result.data.results == null || !result.data.results.length) {
      return [];
    }

    return result.data.results.map((r: any) => {
      return {
        azureId: r.fields['system.id'],
        azureName: r.fields['system.title'],
        azureUrl: r.url,
        azureState: r.fields['system.state'],
      }
    })

    /*const data = {
      "count": 1,
      "results": [
        {
          "project": {
            "name": "Mex",
            "id": "ec0889e0-36ef-43d9-a529-428eb921f160"
          },
          "fields": {
            "system.id": "79",
            "system.workitemtype": "Task",
            "system.title": "LoginTwoFA  console warning",
            "system.assignedto": "Desmond <desmond@duedex.com>",
            "system.state": "To Do",
            "system.tags": "",
            "system.rev": "2",
            "system.createddate": "2020-01-07T07:25:42.760Z",
            "system.changeddate": "2020-01-07T07:29:07.820Z"
          },
          "hits": [
            {
              "fieldReferenceName": "system.description",
              "highlights": [
                "This is a no-<highlighthit>op</highlighthit>, but it indicates a memory leak in your application."
              ]
            },
            {
              "fieldReferenceName": "system.description",
              "highlights": [
                "This is a no-<highlighthit>op</highlighthit>, but it indicates a memory leak in your application."
              ]
            }
          ],
          "url": "https://dev.azure.com/DueDEX/_apis/wit/workItems/79"
        }
      ],
      "infoCode": 0,
      "facets": {
        "System.TeamProject": [
          {
            "name": "Mex",
            "id": "Mex",
            "resultCount": 1
          }
        ],
        "System.WorkItemType": [
          {
            "name": "Task",
            "id": "Task",
            "resultCount": 1
          }
        ],
        "System.State": [
          {
            "name": "To Do",
            "id": "To Do",
            "resultCount": 1
          }
        ],
        "System.AssignedTo": [
          {
            "name": "Desmond <desmond@duedex.com>",
            "id": "Desmond <desmond@duedex.com>",
            "resultCount": 1
          }
        ]
      }
    }*/

  }

  /**
   * Returns first 20 tasks suits the given query
   */
  getTasks = async (query: string,
                    organizationName: string,
                    projectName: string,
                    teamId: string,
                    userId: string) => {
    L.i(`getTasks - ${query}`)
    try {

      L.i(`getTasks - ${baseUrlDevAzure}/${organizationName}/${projectName}/${teamId}/_apis/wit/wiql`)

      const result = await axios.post(
        `${baseUrlDevAzure}/${organizationName}/${projectName}/${teamId}/_apis/wit/wiql`,
        {query: `SELECT * FROM WorkItems WHERE [Title] CONTAINS '${query}'`},
        this.apiConfig(userId)
      );

      L.i(`getTasks - ${JSON.stringify(result.data, null, 2)}`)

      const ids = result.data.workItems.map((i: any) => i.id)

      // GET https://dev.azure.com/{organization}/{project}/_apis/wit/workitems?ids={ids}&api-version=5.1

      const result1 = await axios.get(
        `${baseUrlDevAzure}/${organizationName}/${projectName}/_apis/wit/workitems`,
        //{query: `SELECT * FROM WorkItems WHERE [Title] CONTAINS '${query}'`},
        this.apiConfig(userId,
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
  getProfile = async (token: string) => {
    L.i(`getProfile`)
    const result = await axios.get(Endpoints.profile, {headers: this.authHeader(token)});
    return result.data;
  }

  getOrganizations = async (token: string): Promise<Array<Organization>> => {
    L.i(`getOrganizations`)
    try {
      const result = await axios.get(Endpoints.accounts, {headers: this.authHeader(token)});
      L.i(`getOrganizations - ${JSON.stringify(result.data, null, 2)}`)
      return result.data.map((o: any) => ({
        id: '',
        azureId: o.AccountId,
        name: o.AccountName
      }));
    } catch (e) {
      L.e(`getOrganizations - error - ${e}`)
      return null;
    }
  }

  getProjects = async (organizationName: string, token: string): Promise<Array<Project>> => {
    try {
      const result = await axios.get(
        `${baseUrlDevAzure}/${organizationName}/_apis/projects`,
        {headers: this.authHeader(token)},
      );
      L.i(`getProjects - ${JSON.stringify(result.data, null, 2)}`)
      return result.data.value.map((e: any) => ({
        azureId: e.id,
        name: e.name,
      }));
    } catch (e) {
      L.e(`getProjects - error - ${e}`)
      return null;
    }
  }

  /*getProjects = async () => {
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
  }*/

  apiConfig = (userId: string, params?: Object) => {
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

  config = (token: string, params?: Object) => {
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      params: {
        ...params,
        'api-version': '5.1',
      },
    }
  }

  apiConfigTokenOnly = (userId: string) => {
    return {
      headers: {
        'Authorization': `Bearer ${this.accessToken(userId)}`,
      },
    }
  }

  accessToken = (userId: string) => {
    const token = this.cache.getToken(userId)
    L.i(`accessToken - ${token}`)
    if (!token) {
      throw new UnauthorizedError()
    }
    return token
  }

  authHeader = (token: string) => {
    return {
      'Authorization': `Bearer ${token}`,
    }
  }

}

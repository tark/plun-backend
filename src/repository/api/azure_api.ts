import {UnauthorizedError} from "../../unauthorized_error";
import axios from "axios";
import qs from "qs";
import Logger from "../../util/logger";
import Cache from "../cache";
import {AzureAuthResponse, AzureProfile, Organization, Project, Task} from "../models/models";

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
   * Auth by authCode. Returns an auth response.
   */
  auth = async (authCode: string): Promise<AzureAuthResponse> => {
    L.i(`auth`)
    try {
      const response = await axios.post(
        Endpoints.token,
        qs.stringify({
          'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          'client_assertion': encodeURI(process.env.AZURE_CLIENT_SECRET),
          'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          'assertion': encodeURI(authCode),
          'redirect_uri': callbackUrl,
        }),
      );

      L.i(`auth - token - ${JSON.stringify(response.data)}`)
      const {access_token, refresh_token, expires_in, token_type} = response.data

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        tokenType: token_type
      }
    } catch (e) {
      L.i(`auth - ${e}`)
      throw e;
    }
  }

  /**
   * Refreshes the auth azure token by using the refresh token from the memory
   */
  refreshToken = async (refreshToken: string): Promise<AzureAuthResponse> => {
    L.i(`refreshToken`)

    if (!refreshToken) {
      throw new Error('refreshToken parameter is missing');
    }

    const response = await axios.post(
      Endpoints.token,
      qs.stringify({
        'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        'client_assertion': encodeURI(process.env.AZURE_CLIENT_SECRET),
        'grant_type': 'refresh_token',
        'assertion': encodeURI(refreshToken),
        'redirect_uri': callbackUrl,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const {access_token, refresh_token, expires_in, token_type} = response.data

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      tokenType: token_type
    }

  }

  /**
   * Use this
   * https://docs.microsoft.com/en-us/rest/api/azure/devops/search/work%20item%20search%20results/fetch%20work%20item%20search%20results?view=azure-devops-rest-6.0#workitemresult
   */
  searchTasks = async (organizationName: string,
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
        azureId: Number(r.fields['system.id']),
        name: r.fields['system.title'],
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

  getTasksByIds = async (organizationName: string,
                         projectName: string,
                         ids: Array<number>,
                         token: string): Promise<Array<Task>> => {
    L.i(`getTasksByIds - ${organizationName}, ${projectName}, ${ids}, length: ${ids.length}`)

    if (!ids || !ids.length) {
      return []
    }

    const result = await axios.get(
      `${baseUrlDevAzure}/${organizationName}/${projectName}/_apis/wit/workitems`,
      {
        headers: this.authHeader(token),
        params: {
          ids: ids.join(',')
        }
      }
    );

    return result.data.value.map((v: any) => {
      return {
        name: v.fields['System.Title'],
        azureId: Number(v.id),
        azureState: v.fields['System.State'],
        azureUrl: v.url.replace('_apis/wit/workItems', '_workitems/edit'),
        azureOrganizationName: organizationName,
        azureProjectName: projectName,
      }
    });

  }

  /**
   * Returns the current user based on current auth token
   */
  getProfile = async (token: string): Promise<AzureProfile> => {
    L.i(`getProfile`)
    const result = await axios.get(Endpoints.profile, {headers: this.authHeader(token)});
    return result.data;
  }

  getOrganizations = async (token: string): Promise<Array<Organization>> => {
    L.i(`getOrganizations`)
    try {
      const result = await axios.get(Endpoints.accounts, {headers: this.authHeader(token)});
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

  authHeader = (token: string) => {
    return {
      'Authorization': `Bearer ${token}`,
    }
  }

}

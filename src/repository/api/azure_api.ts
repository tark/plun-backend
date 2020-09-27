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
        azureId: r.fields['system.id'],
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


    //L.i(`getTasksByIds - ${JSON.stringify(result.data, null, 2)}`)

    const data = {
      "count": 4,
      "value": [
        {
          "id": 1283,
          "rev": 17,
          "fields": {
            "System.AreaPath": "Mex",
            "System.TeamProject": "Mex",
            "System.IterationPath": "Mex\\Week 2 August 2020",
            "System.WorkItemType": "Product Backlog Item",
            "System.State": "Done",
            "System.Reason": "Work finished",
            "System.AssignedTo": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "System.CreatedDate": "2020-08-10T03:21:45.187Z",
            "System.CreatedBy": {
              "displayName": "Robert",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
                }
              },
              "id": "e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "uniqueName": "Robert@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk",
              "descriptor": "aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
            },
            "System.ChangedDate": "2020-08-26T02:30:32.07Z",
            "System.ChangedBy": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "System.CommentCount": 5,
            "System.Title": "Affiliate campaign page",
            "System.BoardColumn": "Done",
            "System.BoardColumnDone": false,
            "Microsoft.VSTS.Common.StateChangeDate": "2020-08-11T06:56:19.123Z",
            "Microsoft.VSTS.Common.ActivatedDate": "2020-08-11T03:44:10.383Z",
            "Microsoft.VSTS.Common.ActivatedBy": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "Microsoft.VSTS.Common.ClosedDate": "2020-08-11T06:56:19.123Z",
            "Microsoft.VSTS.Common.ClosedBy": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "Microsoft.VSTS.Common.Priority": 1,
            "Microsoft.VSTS.Common.ValueArea": "Business",
            "Microsoft.VSTS.Common.BusinessValue": 10,
            "Microsoft.VSTS.Common.BacklogPriority": 1999984503,
            "WEF_5D2B03550A4F41F5A1AC2C9892A54656_Kanban.Column": "Done",
            "WEF_5D2B03550A4F41F5A1AC2C9892A54656_Kanban.Column.Done": false,
            "System.Description": "please merge this branch:<div style=\"box-sizing:border-box;font-family:&quot;Segoe UI&quot;, system-ui, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, sans-serif;\">campaign.dev.affiliate.xjonathan.me/campaign/invitee to affiliate console.</div><div style=\"box-sizing:border-box;font-family:&quot;Segoe UI&quot;, system-ui, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, sans-serif;\">lots of affiliate ask for invitation code from our BD team. if we launch this page, they could check their code themself.</div>",
            "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>merge campaign page into affiliate console</div>",
            "Custom.Figma": "<div>none</div>"
          },
          "url": "https://dev.azure.com/DueDEX/ec0889e0-36ef-43d9-a529-428eb921f160/_apis/wit/workItems/1283"
        },
        {
          "id": 1246,
          "rev": 3,
          "fields": {
            "System.AreaPath": "Mex",
            "System.TeamProject": "Mex",
            "System.IterationPath": "Mex",
            "System.WorkItemType": "Bug",
            "System.State": "Approved",
            "System.Reason": "Approved by the Product Owner",
            "System.CreatedDate": "2020-08-05T08:20:34.72Z",
            "System.CreatedBy": {
              "displayName": "Robert",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
                }
              },
              "id": "e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "uniqueName": "Robert@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk",
              "descriptor": "aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
            },
            "System.ChangedDate": "2020-08-26T02:30:32.07Z",
            "System.ChangedBy": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "System.CommentCount": 0,
            "System.Title": "UC web browser for Android can not open Homepage",
            "System.BoardColumnDone": false,
            "Microsoft.VSTS.Common.StateChangeDate": "2020-08-05T08:20:39.543Z",
            "Microsoft.VSTS.Common.Priority": 2,
            "Microsoft.VSTS.Common.Severity": "3 - Medium",
            "Microsoft.VSTS.Common.ValueArea": "Business",
            "Microsoft.VSTS.Common.BacklogPriority": 1999980948,
            "WEF_5D2B03550A4F41F5A1AC2C9892A54656_Kanban.Column.Done": false,
            "Microsoft.VSTS.TCM.ReproSteps": "<div>1.Download UC web browser for Android.</div><div>2.Open duedex.com</div><div><br></div><div>Background: UC web browser was super popular in China, Tons of user was using that. it may block them from enter our webpage.</div>",
            "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>home page will open in UC web browser<br></div>",
            "Custom.ExpectedResults": "<ol><li>home page will open</li></ol>",
            "Custom.ActualResults": "<div>home page wont open, it will show blank page</div>"
          },
          "url": "https://dev.azure.com/DueDEX/ec0889e0-36ef-43d9-a529-428eb921f160/_apis/wit/workItems/1246"
        },
        {
          "id": 804,
          "rev": 23,
          "fields": {
            "System.AreaPath": "Mex",
            "System.TeamProject": "Mex",
            "System.IterationPath": "Mex",
            "System.WorkItemType": "Product Backlog Item",
            "System.State": "Done",
            "System.Reason": "Work finished",
            "System.AssignedTo": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "System.CreatedDate": "2020-06-22T03:13:12.863Z",
            "System.CreatedBy": {
              "displayName": "Robert",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
                }
              },
              "id": "e4fbb536-ddd2-4588-b0d2-fe5b35a33820",
              "uniqueName": "Robert@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk",
              "descriptor": "aad.OGYxNzRkZGEtMWIyOC03MTFjLWIzNTgtMzI4YjQxOTQ4YWFk"
            },
            "System.ChangedDate": "2020-08-26T02:30:20.757Z",
            "System.ChangedBy": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "System.CommentCount": 6,
            "System.Title": "App - withdrawal workflow",
            "System.BoardColumn": "Done",
            "System.BoardColumnDone": false,
            "Microsoft.VSTS.Common.StateChangeDate": "2020-07-31T04:57:12.693Z",
            "Microsoft.VSTS.Common.ClosedDate": "2020-07-31T04:57:12.693Z",
            "Microsoft.VSTS.Common.ClosedBy": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "Microsoft.VSTS.Common.Priority": 1,
            "Microsoft.VSTS.Common.ValueArea": "Business",
            "Microsoft.VSTS.Common.BacklogPriority": 1999944924,
            "WEF_5D2B03550A4F41F5A1AC2C9892A54656_Kanban.Column": "Done",
            "WEF_5D2B03550A4F41F5A1AC2C9892A54656_Kanban.Column.Done": false,
            "System.Description": "<div style=\"box-sizing:border-box;font-family:&quot;Segoe UI&quot;, system-ui, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, sans-serif;\"><div><ol><li>When user withdrawal and did not binding GA, it will not jump to GA binding automatically</li><li>When binding GA, can not send email verification code</li><li>When withdrawal, after entering GA code, the user will enter email/mobile verification. Send and Cancel button was too close, the user may misclick it.</li><li>Click 'Send' email/mobile verification code, will see error message 'not verified'</li><li>Actually in withdrawal history it was 'not verified' but in APP, we dont have 'Verify' and 'Cancel' button. But at this time, user's money was freezed, he may think his withdrawal was success.</li></ol></div><div><br></div><div>①提币未绑定谷歌验证，未自动跳转到 谷歌验证 绑定页面。</div><div>②谷歌验证绑定过程，根本无法发出邮件验证码，最后我用的电脑端才绑定成功。</div><div>③提币过程中，输入谷歌验证之后的 邮箱/手机 验证码，发送 和 取消 按钮太近容易误操作。</div><div>④邮箱/手机验证码 点击发送，会直接报错 未审核 。</div><div>⑤然后 APP 端将提币直接放入到提币历史，进入提币历史显示 未验证 但没有提供 验证 和 取消 这两个功能按钮，此时用户资金已经冻结，以为提币申请成功了，实际没有，而且无法进行下一步操作，只能进入PC端点击 验证 或 取消 。</div></div><br><br>",
            "Microsoft.VSTS.Common.AcceptanceCriteria": "<div><ol><li>Will jump to GA binding automatically</li><li>When binding GA, could send Email verification code</li><li>'Send' and 'Cancel' button will have larger space</li><li>Click 'Send' will not have error message</li><li>In Withdrawal history, if the record was 'not verified' then it should have 'verify' and 'cancel' button.</li></ol></div>"
          },
          "url": "https://dev.azure.com/DueDEX/ec0889e0-36ef-43d9-a529-428eb921f160/_apis/wit/workItems/804"
        },
        {
          "id": 1209,
          "rev": 13,
          "fields": {
            "System.AreaPath": "Mex",
            "System.TeamProject": "Mex",
            "System.IterationPath": "Mex\\Week 4 July 2020",
            "System.WorkItemType": "Task",
            "System.State": "Done",
            "System.Reason": "Work finished",
            "System.AssignedTo": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "System.CreatedDate": "2020-08-02T14:21:05.837Z",
            "System.CreatedBy": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "System.ChangedDate": "2020-08-03T10:07:44.4Z",
            "System.ChangedBy": {
              "displayName": "Airon Tark",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/540bbe33-a046-4519-92e1-d517e875a06d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
                }
              },
              "id": "540bbe33-a046-4519-92e1-d517e875a06d",
              "uniqueName": "airon@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4",
              "descriptor": "aad.M2FlNjQwZDYtODQ1Ni03OGE0LWFhY2UtZjI1MWE3M2FhZDY4"
            },
            "System.CommentCount": 5,
            "System.Title": "Add geetest support to Mex.Server",
            "Microsoft.VSTS.Common.Activity": "Development",
            "Microsoft.VSTS.Common.StateChangeDate": "2020-08-02T15:06:58.317Z",
            "Microsoft.VSTS.Common.ActivatedDate": "2020-08-02T14:21:43.953Z",
            "Microsoft.VSTS.Common.ActivatedBy": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "Microsoft.VSTS.Common.ClosedDate": "2020-08-02T15:06:58.317Z",
            "Microsoft.VSTS.Common.ClosedBy": {
              "displayName": "Jonathan LEI",
              "url": "https://spsprodea1.vssps.visualstudio.com/A472a1fa3-6d94-4ca8-8374-86fd43058fca/_apis/Identities/0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "_links": {
                "avatar": {
                  "href": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
                }
              },
              "id": "0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d",
              "uniqueName": "jonathan@duedex.com",
              "imageUrl": "https://dev.azure.com/DueDEX/_apis/GraphProfile/MemberAvatars/aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk",
              "descriptor": "aad.OGM2ZDY4MzItZTYxMC03MDJlLWFmMDctYjVhN2Q1NTE4ZGFk"
            },
            "Microsoft.VSTS.Common.Priority": 2,
            "System.History": "<div><a href=\"#\" data-vss-mention=\"version:2.0,0c38b4a2-4e08-447d-8cd2-7c4a1c4baf3d\">@Jonathan LEI</a>&nbsp;ok</div>"
          },
          "commentVersionRef": {
            "commentId": 1993074,
            "version": 1,
            "url": "https://dev.azure.com/DueDEX/ec0889e0-36ef-43d9-a529-428eb921f160/_apis/wit/workItems/1209/comments/1993074/versions/1"
          },
          "url": "https://dev.azure.com/DueDEX/ec0889e0-36ef-43d9-a529-428eb921f160/_apis/wit/workItems/1209"
        }
      ]
    }

    return result.data.value.map((v: any) => {
      return {
        name: v.fields['System.Title'],
        azureId: v.id,
        azureState: v.fields['System.State'],
        azureUrl: v.url.replace('_apis/wit/workItems', '_workitems/edit')
      }
    });

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

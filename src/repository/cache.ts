import Logger from "../util/logger";
import * as NodeCache from "node-cache";

const L = new Logger('Cache');

export default class Cache {

  cache: NodeCache;

  constructor(cache : NodeCache) {
    this.cache = cache;
  }

  setTeamId = (teamId: string) => {
    this.set('team_id', teamId)
  }

  getTeamId = () => {
    return this.get('team_id')
  }

  setProjectId = (projectId: string) => {
    this.set('project_id', projectId)
  }

  getProjectId = () => {
    return this.get('project_id')
  }

  setOrganization = (organization: string) => {
    this.set('organization', organization)
  }

  getOrganization = () => {
    return this.get('organization')
  }

  setToken = (userId: string, token: string) => {
    L.i(`setToken - ${userId}`)
    this.set(`token_${userId}`, token)
  }

  getToken = (userId: string): string => {
    L.i(`getToken - ${userId}`)
    return this.get(`token_${userId}`)
  }

  set = (id: string, value: string | number) => {
    this.cache.set(id, value)
  }

  get = (id: string): string => {
    return this.cache.get(id)
  }

}

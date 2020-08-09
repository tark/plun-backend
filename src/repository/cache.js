import Logger from "../util/logger.js";

const L = new Logger('Cache');

export default class Cache {

  constructor(cache) {
    this.cache = cache;
  }

  setTeamId = (teamId) => {
    this.set('team_id', teamId)
  }

  getTeamId = () => {
    return this.get('team_id')
  }

  setProjectId = (projectId) => {
    this.set('project_id', projectId)
  }

  getProjectId = () => {
    return this.get('project_id')
  }

  setOrganization = (organization) => {
    this.set('organization', organization)
  }

  getOrganization = () => {
    return this.get('organization')
  }

  setToken = (userId, token) => {
    L.i(`setToken - ${userId}`)
    this.set(`token_${userId}`, token)
  }

  getToken = (userId) => {
    L.i(`getToken - ${userId}`)
    return this.get(`token_${userId}`)
  }

  set = (id, value) => {
    this.cache.set(id, value)
  }

  get = (id) => {
    return this.cache.get(id)
  }

}

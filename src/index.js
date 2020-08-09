import express from "express";
import UsersController from "./controllers/users_controller.js";
import cors from 'cors'
import dotenv from 'dotenv'
import firebase from 'firebase';
import TasksRepository from "./repository/tasks_repository.js";
import Cache from "./repository/cache.js";
import NodeCache from "node-cache";
import AzureApi from "./repository/api/azure_api.js";
import UsersRepository from "./repository/users_repository.js";
import {UnauthorizedError} from "./unauthorized_error.js";
import Logger from "./util/logger.js";

const L = new Logger('index');

firebase.initializeApp({
  apiKey: "AIzaSyCt7wqBvDnVdJpLhnvUf35AGCCqp5Q79n0",
  authDomain: "plun-io.firebaseapp.com",
  databaseURL: "https://plun-io.firebaseio.com",
  projectId: "plun-io",
  storageBucket: "plun-io.appspot.com",
  messagingSenderId: "1072198800950",
  appId: "1:1072198800950:web:691bcd591d810fc60eaa97",
  measurementId: "G-V897FVJEKK"
});
const db = firebase.firestore();
const nodeCache = new NodeCache();
const cache = new Cache(nodeCache);
const azureApi = new AzureApi(cache);

const tasksRepository = new TasksRepository(db);
const usersRepository = new UsersRepository(db);
const usersController = new UsersController(cache, usersRepository, azureApi);
const tasksController = new UsersController(cache, tasksRepository);

dotenv.config()

const app = express();
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.listen(3001, () => console.log("Server running on port 3001"));

/**
 * First of all user try to auth just by id
 * hoping the server still have it's session
 * If token is not valid anymore, server returns 401 not authorized
 */
app.post('/auth', async (req, res, next) => {

  L.i(`route /auth`)

  try {
    const {userId} = req.body;
    const user = await usersController.auth(userId);
    await res.status(200).json(user)
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

/**
 * Frontend should call this if it has no userId,
 * or if the previous try to auth by token returned 401 unauthorized error.
 */
app.post('/auth-by-code', async (req, res, next) => {

  L.i(`route /auth-by-code`)

  try {
    const {code} = req.body;
    const user = await usersController.authByCode(code);
    await res.status(200).json(user);
  } catch (e) {
    L.i(`error - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

app.get("/tasks", async (req, res, next) => {

  L.i(`route test`)
  res.status(200).send()

});

app.get("/tasks-suggestions", async (req, res, next) => {

  function sleep(delay = 0) {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  await sleep(2000)

  res
    .status(200)
    .send(['adfadf', 'super task', 'suck task', 'adfasdf'])

});

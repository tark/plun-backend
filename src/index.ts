import express from "express";
import UsersController from "./controllers/users_controller";
import cors from 'cors'
import * as dotenv from 'dotenv'
import * as firebase from 'firebase';
import TasksRepository from "./repository/tasks_repository";
import Cache from "./repository/cache";
import NodeCache from "node-cache";
import AzureApi from "./repository/api/azure_api";
import {UnauthorizedError} from "./unauthorized_error";
import Logger from "./util/logger";
import {Express} from "express";
import TasksController from "./controllers/tasks_controller";
import {Plan, Task} from "./repository/models/models";
import PlansController from "./controllers/plans_controller";

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

const usersController = new UsersController(db, cache, azureApi);
const tasksRepository = new TasksRepository(db, azureApi)
const tasksController = new TasksController(db, cache, azureApi, tasksRepository);
const plansController = new PlansController(db, cache, azureApi, tasksRepository);

dotenv.config()

const app: Express = express();
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.listen(3001, () => console.log("Server running on port 3001"));

app.get('/profile', async (req, res, next) => {

  L.i(`get /profile`)

  try {
    // as any because of this
    // https://www.reddit.com/r/expressjs/comments/gz37m4/reqquery_and_typescript_parsedqs/
    const {token} = req.query as any;
    const profile = await usersController.getProfile(token);
    res.status(200).send(profile)
  } catch (e) {
    L.e(`route /projects - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

})

/**
 * First of all user try to auth just by id
 * hoping the server still have it's session
 * If token is not valid anymore, server returns 401 not authorized
 */
app.post('/auth', async (req, res, next) => {

  L.i(`post /auth`)

  try {
    const {userId} = req.body;
    const user = await usersController.auth(userId);
    await res.status(200).json(user)
  } catch (e) {
    L.e(`route /auth - ${e}`)
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
app.post('/token', async (req, res, next) => {

  L.i(`post /token`)

  try {
    const {authCode} = req.body;
    if (!authCode) {
      next(new Error('Auth code is missing'))
      return;
    }
    const token = await usersController.getAccessToken(authCode);
    //const user = await usersController.getProfile(token);
    //L.i(`route /auth-by-code - return user - ${JSON.stringify(user)}`)
    await res.send(token);
  } catch (e) {
    L.e(`route /auth-by-code - ${e}`)
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

/**
 *
 */
app.get("/organizations", async (req, res, next) => {
  L.i(`get /organizations`)

  try {
    // as any because of this
    // https://www.reddit.com/r/expressjs/comments/gz37m4/reqquery_and_typescript_parsedqs/
    const {token} = req.query as any
    const organizations = await usersController.getOrganizations(token);
    res.status(200).send(organizations)
  } catch (e) {
    L.e(`route /organizations - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

app.get("/projects", async (req, res, next) => {
  L.i(`get /projects`)

  try {
    // as any because of this
    // https://www.reddit.com/r/expressjs/comments/gz37m4/reqquery_and_typescript_parsedqs/
    const {organizationName, token} = req.query as any;
    const projects = await usersController.getProjects(organizationName, token);
    //res.status(200).json({organizations: organizations.map(o => JSON.stringify(o))})
    res.status(200).send(projects)
  } catch (e) {
    L.e(`route /projects - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

app.get("/tasks-suggestions", async (req, res, next) => {
  try {
    const {organizationName, projectName, query, token} = req.query as any;
    L.i(`get /tasks-suggestions - ${organizationName}, ${projectName}, ${query}`)
    const tasks = await tasksController.getSuggestions(organizationName, projectName, query, token)
    L.i(`/tasks-suggestions - ${tasks.map(t => t.name)}`)
    res.status(200).send(tasks)
  } catch (e) {
    L.e(`route /tasks-suggestions - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

/**
 * Create a plan for today
 */
app.post('/plan', async (req, res, next) => {

  L.i(`post /plun`)

  try {
    const {plan} = req.body;
    L.i(`post /plun - ${JSON.stringify(plan, null, 2)}`)
    const user = await plansController.createPlan(plan);
    await res.status(200).json(user)
  } catch (e) {
    L.e(`route /auth - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

/**
 * Returns a PLUN :) for the given date
 * if the date is null - returns the nearest available previous plan
 */
app.get("/plan", async (req, res, next) => {
  try {
    const {organizationName, projectName, date, token} = req.query as any;
    L.i(`get /plun - date: ${date}`)

    if (!date) {
      const plan = await plansController.getPreviousNearestPlan(
        organizationName,
        projectName,
        token
      )
      res.status(200).send(plan)
      return;
    }

    const plan = await plansController.getPlanByDate(
      organizationName,
      projectName,
      date,
      token
    )
    L.i(`get /plun - returning - ${JSON.stringify(plan)}`)
    L.i(`get /plun - returning - --------`)
    res.status(200).send(plan)
  } catch (e) {
    L.e(`route /plun - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

app.delete("/plan", async (req, res, next) => {
  try {
    const {taskId, date} = req.body;
    //const {taskId} = req.query as any;
    L.i(`delete /plan - body - ${JSON.stringify(req.body)}`)
    await plansController.stopPlanTaskForDate(taskId, date)
    res.status(200).send()
  } catch (e) {
    L.e(`route /plun - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

/**
 * Update the task in a plan. Usually for changing the state.
 */
app.patch("/plan", async (req, res, next) => {
  try {
    const plan: Plan = req.body.plan;
    L.i(`patch /plan - plan - ${JSON.stringify(plan)}`)
    const updatedTask = await plansController.update(plan)
    res.status(200).send(updatedTask)
  } catch (e) {
    L.e(`patch /plun - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});


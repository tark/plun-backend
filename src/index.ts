import express, {NextFunction} from "express";
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

const tasksRepository = new TasksRepository(db, azureApi)
const tasksController = new TasksController(db, cache, azureApi, tasksRepository);
const plansController = new PlansController(db, cache, azureApi, tasksRepository);
const usersController = new UsersController(db, cache, azureApi, plansController);

dotenv.config()

const app: Express = express();
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use((req, res, next) => {
  const auth = req.headers.authorization?.split(' ')
  const token = auth[0] === 'Bearer' ? auth[1] : null
  // token required for all paths except auth and refresh token
  if (req.path !== '/auth' && req.path !== '/refreshToken' && !token) {
    return res.sendStatus(401)
  }
  try {
    req.body.token = token
    next();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      res.sendStatus(401)
    } else {
      next(e)
    }
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));

/**
 * First of all user try to auth just by id
 * hoping the server still have it's session
 * If token is not valid anymore, server returns 401 not authorized
 */
app.post('/auth', async (req, res, next) => {
  L.i(`post /auth`)
  try {
    L.i(`post /auth`)
    const {authCode} = req.body;
    const authResponse = await usersController.authByCode(authCode);
    await res.status(200).json(authResponse)
  } catch (e) {
    L.e(`route /auth - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }

});

app.post('/refreshToken', async (req, res, next) => {
  try {
    const refreshToken: string = req.body.refreshToken;

    if (!refreshToken) {
      next(new Error('RefreshToken parameter is missing'))
    }

    const azureAuthResponse = await usersController.refreshToken(refreshToken)
    res.status(200).json(azureAuthResponse)
  } catch (e) {
    L.e(`post /refreshToken - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

// --- PRIVATE ROUTES ---

app.get('/profile', async (req, res, next) => {
  L.i(`get /profile`)
  const {token} = req.body;
  const profile = await usersController.getProfile(token);
  res.status(200).send(profile)
})

app.get("/tasks", async (req, res, next) => {

  L.i(`get /tasks`)
  res.status(200).send()

});

/**
 *
 */
app.get("/organizations", async (req, res, next) => {
  L.i(`get /organizations`)
  try {
    const organizations = await usersController.getOrganizations(req.body.token);
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
    const {token} = req.body;
    const {organizationName} = req.query as any;
    const projects = await usersController.getProjects(organizationName, token);
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
    const {organizationName, projectName, query} = req.query as any;
    const {token} = req.body;
    L.i(`get /tasks-suggestions - ${organizationName}, ${projectName}, ${query}`)
    const tasks = await tasksController.getSuggestions(organizationName, projectName, query, token)
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
    const {plan, token} = req.body;

    checkParameter(plan, 'plan')
    checkParameter(token, 'token')

    L.i(`post /plun - ${JSON.stringify(plan, null, 2)}`)
    const planCreated = await plansController.createPlan(plan, /*organizationName, projectName, */token);
    L.i(`post /plan - ${JSON.stringify(planCreated, null, 2)}`)
    await res.status(200).json(planCreated)
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
    const {organizationName, projectName, date} = req.query as any;
    const {token} = req.body;
    L.i(`get /plun - date: ${date}`)
    const plan = await plansController.getPlan(
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

/**
 * Returns all the plans for all users for the given dates
 */
app.get("/plans", async (req, res, next) => {
  try {
    const {organizationName, projectName, dateFrom, dateTo/*, userId*/} = req.query as any;
    const {token} = req.body;
    L.i(`get /plans - ${dateFrom}, ${dateTo}`)
    const plan = await plansController.getPlans(
      organizationName,
      projectName,
      dateFrom,
      dateTo,
      token
    )
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

/**
 * Update the task in a plan. Usually for changing the state.
 */
app.patch("/plan", async (req, res, next) => {
  try {
    const {plan, token} = req.body;
    L.i(`patch /plan - plan - ${JSON.stringify(plan)}`)
    const updatedPlan = await plansController.update(plan, token)
    L.i(`patch /plan - returning - ${JSON.stringify(updatedPlan)}`)
    res.status(200).json(updatedPlan)
  } catch (e) {
    L.e(`patch /plun - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

app.get("/users", async (req, res, next) => {
  try {
    const {token} = req.body;
    const {organizationName, projectName} = req.query as any;
    L.i(`get /users - ${organizationName}, ${projectName}`)
    const users = await usersController.getUsers(organizationName, projectName, token)
    L.i(`get /users - returning - ${users}`)
    res.status(200).json(users)
  } catch (e) {
    L.e(`get /users - ${e}`)
    if (e instanceof UnauthorizedError) {
      res.status(401)
    } else {
      next(e)
    }
  }
});

const checkParameter = (parameterValue: any, parameterName: string) => {
  if (!parameterValue) {
    throw new Error(`"${parameterName}" parameter is missing`)
  }
}

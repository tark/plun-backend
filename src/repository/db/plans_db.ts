import {firestore} from "firebase";
import {Plan, PlanEntry, Task} from "../models/models";
import moment from "moment";
import Logger from "../../util/logger";
import {DATE_FORMAT} from "../../config/constants";
import WhereFilterOp = firebase.firestore.WhereFilterOp;

const L = new Logger('PlansDb');

export default class PlansDb {

  db: firestore.Firestore;

  constructor(db: firestore.Firestore) {
    this.db = db
  }

  getById = async (id: string): Promise<Plan> => {
    const doc = await this.plans().doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToPlan(doc);
  }

  getByParams = async (date: string, organizationName: string, projectName: string): Promise<Plan> => {
    const querySnapshot = await this.plans()
      .where("date", '==', date)
      .where('azureOrganizationName', '==', organizationName)
      .where('azureProjectName', '==', projectName)
      .get();
    return querySnapshot.docs.map((doc) => this.mapDocToPlan(doc))[0]
  }

  getByOrganizationAndProject = async (organizationName: string, projectName: string): Promise<Array<Plan>> => {
    const querySnapshot = await this.plans()
      .where('azureOrganizationName', '==', organizationName)
      .where('azureProjectName', '==', projectName)
      .get();
    return querySnapshot.docs.map((doc) => this.mapDocToPlan(doc))
  }

  getUserPlansForDates = async (organizationName: string,
                                projectName: string,
                                dateFrom: string,
                                dateTo: string,
                                userId: string): Promise<Array<Plan>> => {
    const querySnapshot = await this.plans()
      .where('azureOrganizationName', '==', organizationName)
      .where('azureProjectName', '==', projectName)
      .where('userId', '==', userId)
      .where('date', '>=', dateFrom)
      .where('date', '<=', dateTo)
      .get();
    return querySnapshot.docs.map((doc) => this.mapDocToPlan(doc))
  }

  getPlansForDates = async (organizationName: string,
                            projectName: string,
                            dateFrom: string,
                            dateTo: string): Promise<Array<Plan>> => {
    const querySnapshot = await this.plans()
      .where('azureOrganizationName', '==', organizationName)
      .where('azureProjectName', '==', projectName)
      .where('date', '>=', dateFrom)
      .where('date', '<=', dateTo)
      .get();
    return querySnapshot.docs.map((doc) => this.mapDocToPlan(doc))
  }

  /**
   * Return the nearest previous plan
   */
  getPreviousPlan = async (): Promise<Plan> => {
    const now = moment().format(DATE_FORMAT);

    // get nearest previous plan
    const query = await this.plans()
      .where('date', '<', now)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    // exit if no tasks
    if (query.empty) {
      return null;
    }

    return this.mapDocToPlan(query.docs[0])

  }

  add = async (plan: Plan): Promise<Plan> => {
    plan = this.prepareForInternalSave(plan)
    const ref = await this.plans().add(plan)
    const doc = await ref.get();
    return this.getById(doc.id)
  }

  delete = (id: string) => {
    return this.plans().doc(id).delete()
  }

  update = async (plan: Plan): Promise<Plan> => {
    const id = plan.id
    if (!id) {
      throw Error('Can not update plan without an `id` field')
    }

    plan = this.prepareForInternalSave(plan)
    const ref = this.plans().doc(id);
    await ref.update(plan);
    return this.getById(id);
  }

  plans = (): firestore.CollectionReference => {
    return this.db.collection('plans');
  }

  mapDocToPlan = (doc: firestore.DocumentSnapshot): Plan => {
    const {entries, date, azureOrganizationName, azureProjectName, userId} = doc.data()
    return {
      id: doc.id,
      entries,
      date,
      azureOrganizationName,
      azureProjectName,
      userId,
    };
  }

  private prepareForInternalSave = (plan: Plan): Plan => {
    delete plan.id
    plan.entries = plan.entries.map((e) => {
      delete e.task
      return e
    })
    return plan
  }

}

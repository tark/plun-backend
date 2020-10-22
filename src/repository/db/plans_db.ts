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

  getByDate = async (date: string): Promise<Plan> => {
    const querySnapshot = await this.plans().where("date", '==', date).get();
    return querySnapshot.docs.map((doc) => this.mapDocToPlan(doc))[0]
  }

  /**
   * Return the nearest previous plan
   */
  getPreviousPlan = async (): Promise<Plan> => {
    const now = moment().format(DATE_FORMAT);

    // get nearest previous plan
    const query = await this.plans()
      .where('date', '<', now)
      .orderBy('date')
      .limit(1)
      .get();

    // exit if no tasks
    if (query.empty) {
      return null;
    }

    return this.mapDocToPlan(query.docs[0])

  }

  add = async (plan: Plan): Promise<Plan> => {
    delete plan.id;
    const ref = await this.plans().add(plan)
    const doc = await ref.get();
    return this.mapDocToPlan(doc);
  }

  delete = (id: string) => {
    return this.plans().doc(id).delete()
  }

  update = async (plan: Plan): Promise<Plan> => {
    const id = plan.id;
    delete plan.id;

    const ref = this.plans().doc(id);
    await ref.update(plan);
    return this.getById(id);
  }

  plans = (): firestore.CollectionReference => {
    return this.db.collection('plans');
  }

  mapDocToPlan = (doc: firestore.DocumentSnapshot): Plan => {
    const {entries, date} = doc.data()
    return {
      id: doc.id,
      entries,
      date,
    };
  }

}

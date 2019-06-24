import { logger } from "./logging";

import { Clause, loadClause } from "./clause";
import { enumerate } from "./lib";
import { CourseInstance } from "./data";

type RawLimit = { at_most: number; where: object };

export class Limit {
	readonly at_most: number;
	readonly where: Clause;

	constructor(data: RawLimit) {
		this.at_most = data.at_most;
		this.where = loadClause(data.where);
	}
}

export class LimitSet {
	readonly limits: ReadonlyArray<Limit>;

	constructor(data?: RawLimit[]) {
		this.limits = (data || []).map(l => new Limit(l));
	}

	apply_limits(courses: ReadonlyArray<CourseInstance>) {
		let clause_counters: Map<Limit, number> = new Map(); //defaultdict(int)
		let course_set = [];

		if (courses) {
			for (let [i, c] of enumerate(courses)) {
				logger.debug(`limit/before/${i}`, { c });
			}
		} else {
			logger.debug("limit/before: []");
		}

		for (let c of courses) {
			let may_yield = false;

			for (let l of this.limits) {
				logger.debug(`limit/check: checking ${c.identity} against`, { l });
				if (c.apply_clause(l.where)) {
					let foo = clause_counters.get(l) || 0;
					if (foo < l.at_most) {
						logger.debug(`limit/increment: ${c.identity} matched`, { l });
						clause_counters.set(l, foo + 1);
						may_yield = true;
					} else {
						logger.debug(`limit/maximum: ${c.identity} matched`, { l });
						may_yield = false;
					}
				} else {
					may_yield = true;
				}
			}

			if (may_yield) {
				course_set.push(c);
			}
		}

		if (course_set.length) {
			for (let [i, c] of enumerate(course_set)) {
				logger.debug(`limit/after/${i}`, { c });
			}
		} else {
			logger.debug("limit/after: []");
		}

		logger.debug("limit/state", { clause_counters });

		return course_set;
	}

	*limited_transcripts(courses: ReadonlyArray<CourseInstance>) {
		/*
        We need to iterate over each combination of limited courses.

        IE, if we have {at-most: 1, where: subject == CSCI}, and three CSCI courses,
        then we need to generate three transcripts - one with each of them.

        To do that, we do … what?
        */

		// skip _everything_ in here if there are no limits to apply
		if (!this.limits.length) {
			logger.debug("No limits to apply");
			yield courses;
			return;
		}

		// step 1: find the number of extra iterations we will need for each limiting clause
		let extra_iter_counters: Map<Limit, number> = new Map();
		for (let l of this.limits) {
			let current = extra_iter_counters.get(l) || 0;

			for (let c of courses) {
				logger.debug(`limit/probe: checking ${c.identity} against`, { l });
				if (c.apply_clause(l.where)) {
					extra_iter_counters.set(l, current + 1);
				}
			}

			// set each counter to the number of extra courses, or 0, to find the number of extra iterations
			current = extra_iter_counters.get(l) || 0;
			extra_iter_counters.set(l, Math.max(0, current - l.at_most));
		}

		// find only the extra iteration counters which were used
		let filled_extra_iter_counters = [...extra_iter_counters.values()].filter(
			v => v > 0,
		);

		// if nothing needs extra iteration, just spit out the limited transcript once
		if (!filled_extra_iter_counters.length) {
			logger.debug("No limits result in extra combinations");
			yield this.apply_limits(courses);
		}

		logger.debug(
			`Limits result in ${filled_extra_iter_counters.length} extra combinations`,
		);
		// TODO: figure out how to do this
		// for _ in extra_iter_counters:
		yield this.apply_limits(courses);
	}
}

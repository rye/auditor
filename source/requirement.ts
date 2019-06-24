import assert from "assert";
import { logger } from "./logging";
import { enumerate, DefaultMap } from "./lib";

import { CourseInstance, CourseStatus } from "./data";
import { SaveRule } from "./save";
import { CourseRule, loadRule, Rule } from "./rule";
import { Solution } from "./solution";
import { Clause } from "./clause";
import { Result } from "./result";

export class RequirementContext {
	readonly transcript: ReadonlyArray<CourseInstance>;
	readonly requirements: ReadonlyMap<string, Requirement>;
	readonly save_rules: ReadonlyMap<string, SaveRule>;
	readonly requirement_cache: WeakMap<Requirement, RequirementState>;
	readonly multicountable: ReadonlyArray<ReadonlyArray<CourseRule | Clause>>;
	claims: DefaultMap<string, Set<Claim>>;

	constructor(args: {
		transcript?: ReadonlyArray<CourseInstance>;
		requirements?: ReadonlyMap<string, Requirement>;
		save_rules?: ReadonlyMap<string, SaveRule>;
		requirement_cache?: WeakMap<Requirement, RequirementState>;
		multicountable?: ReadonlyArray<Array<CourseRule | Clause>>;
		claims?: ReadonlyMap<string, Set<Claim>>;
	}) {
		this.transcript = args.transcript || [];
		this.requirements = args.requirements || new Map();
		this.save_rules = args.save_rules || new Map();
		this.requirement_cache = args.requirement_cache || new WeakMap();
		this.multicountable = args.multicountable || [];
		this.claims = new DefaultMap(
			[...(args.claims || new Map()).entries()],
			() => new Set<Claim>(),
		);
	}

	find_course(c: string): CourseInstance | null {
		for (let course of this.completed_courses()) {
			if (course.course() === c || course.course_shorthand() === c) {
				return course;
			}
		}
		return null;
	}

	has_course(c: string): boolean {
		return this.find_course(c) != null;
	}

	*completed_courses() {
		for (let course of this.transcript) {
			if (course.status !== CourseStatus.DidNotComplete) {
				yield course;
			}
		}
	}

	checkpoint() {
		// TODO: make a copy of this before returning
		return this.claims;
	}

	restore_to_checkpoint(claims: Map<string, Set<Claim>>) {
		// TODO: make a copy of this before restoring
		this.claims = new DefaultMap([...claims.entries()], () => new Set());
	}

	reset_claims() {
		this.claims = DefaultMap.empty(() => new Set());
	}

	make_claim(args: {
		crsid: string;
		course: CourseInstance;
		path: string[];
		clause: CourseRule | Clause;
	}): ClaimAttempt {
		// If the crsid is not in the claims dictionary, insert it with an empty list.
		//
		// If the course that is being claimed has an empty list of claimants,
		// then the claim succeeds.
		//
		// Otherwise...
		//
		// If the claimant is a {course} rule specified with the {including-claimed} option,
		// the claim is recorded, and succeeds.
		//
		// If the claimed course matches multiple `multicountable` rulesets,
		//     the first ruleset applicable to both the course and the claimant is selected.
		//
		// If the claimed course matches a `multicountable` ruleset,
		//     and the claimant is within said `multicountable` ruleset,
		//     and the claimant's clause has not already been used as a claim on this course,
		//     then the claim is recorded, and succeeds.
		//
		// Otherwise, the claim is rejected, with a list of the prior confirmed claims.

		let { crsid, course, path, clause } = args;

		if (!clause) {
			throw new TypeError("clause must be provided");
		}

		let claim = new Claim({
			course_id: crsid,
			claimant_path: path,
			value: clause,
			course: course,
		});

		let potential_conflicts = [...this.claims.get(crsid)].filter(
			c => c.course_id == claim.course_id,
		);

		// # allow topics courses to be taken multiple times
		if (course.is_topic) {
			let conflicts_are_topics = potential_conflicts.every(
				c => c.course.is_topic,
			);
			if (conflicts_are_topics) {
				let conflicting_clbids = new Set(
					potential_conflicts.map(c => c.course.clbid),
				);
				if (!conflicting_clbids.has(course.clbid)) {
					let courses_are_equivalent = potential_conflicts.every(
						c => c.course.identity === course.identity,
					);
					if (courses_are_equivalent) {
						return new ClaimAttempt({ claim, conflict_with: new Set() });
					}
				}
			}
		}

		// # If the claimant is a CourseRule specified with the `.allow_claimed` option,
		// # the claim succeeds (and is not recorded).
		if (clause instanceof CourseRule && clause.allow_claimed) {
			return new ClaimAttempt({ claim });
		}

		// # If the course that is being claimed has an empty list of claimants,
		// # then the claim succeeds.
		if (!potential_conflicts.length) {
			let claims = this.claims.get(crsid);
			claims.add(claim);
			return new ClaimAttempt({ claim });
		}

		let applicable_rulesets = this.multicountable.filter(ruleset => {
			return (
				ruleset.some(c => c.applies_to(course)) &&
				ruleset.some(c => c.mc_applies_same(clause))
			);
		});

		let claim_conflicts = new Set<Claim>();

		// # If the claimed course matches multiple `multicountable` rulesets,
		if (applicable_rulesets.length) {
			// # the first ruleset applicable to both the course and the claimant is selected.
			let ruleset = applicable_rulesets[0];

			// If the claimed course matches a `multicountable` ruleset,
			//   and the claimant is within said `multicountable` ruleset,
			//   and the claimant's clause has not already been used as a claim on this course,
			//   then the claim is recorded, and succeeds.
			for (let ruleclause of ruleset) {
				for (let c of potential_conflicts) {
					if (!ruleclause.mc_applies_same(c)) {
						continue;
					}
					claim_conflicts.add(c);
				}
			}
		} else {
			// # print('no applicable rulesets')
			claim_conflicts = new Set(potential_conflicts);
		}

		if (claim_conflicts.size) {
			return new ClaimAttempt({ claim, conflict_with: claim_conflicts });
		} else {
			this.claims.get(crsid).add(claim);
			return new ClaimAttempt({ claim });
		}
	}
}

export class Claim {
	readonly course_id: string;
	readonly claimant_path: ReadonlyArray<string>;
	readonly value: CourseRule | Clause;
	readonly course: CourseInstance;

	constructor(data: {
		course_id: string;
		claimant_path: string[];
		value: CourseRule | Clause;
		course: CourseInstance;
	}) {
		this.course_id = data.course_id;
		this.claimant_path = data.claimant_path;
		this.value = data.value;
		this.course = data.course;
	}
}

export class ClaimAttempt {
	readonly claim: Claim;
	readonly conflict_with: ReadonlySet<Claim>;

	constructor(args: { claim: Claim; conflict_with?: Set<Claim> }) {
		let { claim, conflict_with = new Set<Claim>() } = args;
		this.claim = claim;
		this.conflict_with = conflict_with;
	}

	failed(): boolean {
		return this.conflict_with.size > 0;
	}
}

export class RequirementState {
	private done: boolean = false;
	private vals: Array<any> = [];
	private readonly iter: Iterable<any>;

	constructor(iterable: Iterable<any>) {
		this.iter = iterable;
		this.done = false;
		this.vals = [];
	}

	*iter_solutions() {
		for (let item of this.vals) {
			yield item;
		}

		// chain vals so far & then gen the rest
		if (!this.done) {
			for (let item of this._gen_iter()) {
				yield item;
			}
		}
	}

	private *_gen_iter() {
		// gen new vals, appending as it goes
		for (let new_val of this.iter) {
			this.vals.push(new_val);
			yield new_val;
		}

		this.done = true;
	}
}

export class Requirement {
	readonly type = "requirement";
	readonly name: string;
	readonly saves: ReadonlyMap<string, SaveRule>;
	readonly requirements: ReadonlyMap<string, Requirement>;
	readonly result?: Rule;
	readonly message?: string;
	readonly audited_by?: "department" | "registrar";
	readonly contract: boolean;

	constructor(name: string, data: { [key: string]: any }) {
		this.name = name;
		this.message = data.message;
		this.contract = data.contract || false;

		let requirements = Object.entries(data.requirements || {}).map(
			([k, v]: [string, any]) =>
				[k, new Requirement(k, v)] as [string, Requirement],
		);
		this.requirements = new Map(requirements);

		let result = data.result;
		if (result) {
			this.result = loadRule(result);
		}

		let saves = Object.entries(data.saves || {}).map(
			([k, v]: [string, any]) => [k, new SaveRule(k, v)] as [string, SaveRule],
		);
		this.saves = new Map(saves);

		if (data.department_audited || false) {
			this.audited_by = "department";
		} else if (data["department-audited"] || false) {
			this.audited_by = "department";
		} else if (data.registrar_audited || false) {
			this.audited_by = "registrar";
		}
	}

	toJSON() {
		return {
			type: "requirement",
			name: this.name,
			saves: Object.fromEntries(this.saves),
			requirements: Object.fromEntries(this.requirements),
			message: this.message,
			result: this.result,
			audited_by: this.audited_by,
			contract: this.contract,
			state: "rule",
			status: "pending",
			ok: false,
			rank: 0,
			claims: [],
		};
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		// assert isinstance(self.name, str)
		// assert self.name.strip() != ""

		if (this.message != null) {
			assert(typeof this.message === "string");
			assert(this.message.trim() !== "");
		}

		let children = this.requirements;

		let validated_saves: Map<string, SaveRule> = new Map();
		for (let save of this.saves.values()) {
			let new_ctx = new RequirementContext({
				transcript: ctx.transcript,
				save_rules: validated_saves,
				requirements: children,
			});
			save.validate({ ctx: new_ctx });
			validated_saves.set(save.name, save);
		}

		let new_ctx = new RequirementContext({
			transcript: ctx.transcript,
			save_rules: this.saves,
			requirements: children,
		});

		if (this.result) {
			this.result.validate({ ctx: new_ctx });
		}
	}

	*solutions({ ctx, path }: { ctx: RequirementContext; path: string[] }) {
		path = [...path, `$req->${this.name}`];

		let header = `${path}\n\trequirement "${this.name}"`;

		logger.debug(`${header} has not been evaluated`);

		if (!this.message) {
			logger.debug(`${header} has no message`);
		}

		if (!this.audited_by) {
			logger.debug(`${header} is not audited`);
		}

		if (!this.result) {
			logger.debug(`${header} does not have a result`);
			yield new RequirementSolution(this, { inputs: [] });
			return;
		} else {
			logger.debug(`${header} has a result`);
		}

		let new_ctx = new RequirementContext({
			transcript: ctx.transcript,
			save_rules: this.saves,
			requirements: this.requirements,
		});

		path = [...path, ".result"];

		let ident = [...path, this.name].join(",");

		for (let [i, solution] of enumerate(
			this.result.solutions({ ctx: new_ctx, path: path }),
		)) {
			yield new RequirementSolution(this, {
				inputs: [[ident, i]],
				solution: solution,
			});
		}
	}

	estimate({ ctx }: { ctx: RequirementContext }) {
		if (!this.result) {
			return 0;
		}

		let new_ctx = new RequirementContext({
			transcript: ctx.transcript,
			save_rules: this.saves,
			requirements: this.requirements,
		});

		return this.result.estimate({ ctx: new_ctx });
	}
}

export class RequirementSolution implements Solution {
	readonly type = "requirement";
	readonly name: string;
	readonly saves: ReadonlyMap<string, SaveRule>;
	readonly requirements: ReadonlyMap<string, Requirement>;
	readonly result?: Solution;
	readonly inputs: ReadonlyArray<[string, number]>;
	readonly message?: string;
	readonly audited_by?: string;
	readonly contract: boolean;

	constructor(
		req: Requirement,
		args: { solution?: Solution; inputs: Array<[string, number]> },
	) {
		let { solution, inputs } = args;
		this.inputs = inputs;
		this.result = solution;
		this.name = req.name;
		this.saves = req.saves;
		this.requirements = req.requirements;
		this.message = req.message;
		this.audited_by = req.audited_by;
		this.contract = req.contract;
	}

	toJSON() {
		return {
			type: "requirement",
			name: this.name,
			saves: Object.fromEntries(this.saves),
			requirements: Object.fromEntries(this.requirements),
			message: this.message,
			result: this.result,
			audited_by: this.audited_by,
			contract: this.contract,
			state: this.state(),
			status: "pending",
			ok: this.ok(),
			rank: this.rank(),
			claims: this.claims(),
		};
	}

	matched() {
		return this.result;
	}

	state() {
		if (this.audited_by) {
			return "solution";
		}
		if (!this.result) {
			return "solution";
		}
		return this.result.state();
	}

	claims() {
		if (this.audited_by) {
			return [];
		}
		if (!this.result) {
			return [];
		}
		return this.result.claims();
	}

	ok() {
		if (!this.result) {
			return true;
		}
		return this.result.ok();
	}

	rank() {
		if (!this.result) {
			return 0;
		}
		return this.result.rank();
	}

	audit(args: { ctx: RequirementContext; path: string[] }): RequirementResult {
		if (!this.result) {
			// TODO: return something better
			return new RequirementResult(this);
		}

		let { ctx, path } = args;
		let result = this.result.audit({ ctx, path });
		return new RequirementResult(this, result);
	}
}

export class RequirementResult implements Result {
	readonly name: string;
	readonly saves: ReadonlyMap<string, SaveRule> = new Map();
	readonly requirements: ReadonlyMap<string, Requirement> = new Map();
	readonly inputs: ReadonlyArray<[string, number]> = [];
	readonly message?: string = undefined;
	readonly result?: Result = undefined;
	readonly audited_by?: string = undefined;
	readonly contract: boolean = false;

	constructor(sol: RequirementSolution, result?: Result) {
		this.name = sol.name;
		this.saves = sol.saves;
		this.requirements = sol.requirements;
		this.inputs = sol.inputs;
		this.message = sol.message;
		this.audited_by = sol.audited_by;
		this.contract = sol.contract;
		this.result = result;
	}

	toJSON() {
		return {
			type: "requirement",
			name: this.name,
			saves: Object.fromEntries(this.saves),
			requirements: Object.fromEntries(this.requirements),
			message: this.message,
			result: this.result,
			audited_by: this.audited_by,
			contract: this.contract,
			state: this.state(),
			status: this.ok() ? "pass" : "problem",
			ok: this.ok(),
			rank: this.rank(),
			claims: this.claims(),
		};
	}

	state() {
		if (this.audited_by) {
			return "result";
		}
		if (!this.result) {
			return "result";
		}
		return this.result.state();
	}

	claims() {
		if (this.audited_by) {
			return [];
		}
		if (!this.result) {
			return [];
		}
		return this.result.claims();
	}

	ok(): boolean {
		// TODO: remove this once exceptions are in place
		if (this.audited_by) {
			return true;
		}
		if (!this.result) {
			return false;
		}
		return this.result.ok();
	}

	rank() {
		if (!this.result) {
			return 0;
		}

		let boost = this.ok() ? 1 : 0;
		return this.result.rank() + boost;
	}
}

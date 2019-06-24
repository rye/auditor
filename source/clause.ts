import assert from "assert";
import { logger } from "./logging";
import { Decimal } from "decimal.js";
import { CourseRule } from "./rule";
import { Claim } from "./requirement";

export enum Operator {
	LessThan = "$lt",
	LessThanOrEqualTo = "$lte",
	GreaterThan = "$gt",
	GreaterThanOrEqualTo = "$gte",
	EqualTo = "$eq",
	NotEqualTo = "$neq",
	In = "$in",
}

export function operatorFromString(op: string): Operator {
	switch (op) {
		case "$lt":
			return Operator.LessThan;
		case "$lte":
			return Operator.LessThanOrEqualTo;
		case "$gt":
			return Operator.GreaterThan;
		case "$gte":
			return Operator.GreaterThanOrEqualTo;
		case "$eq":
			return Operator.EqualTo;
		case "$neq":
			return Operator.NotEqualTo;
		case "$in":
			return Operator.In;
		default:
			throw new TypeError(`"${op}" is not a valid operator`);
	}
}

export interface Clause {
	mc_applies_same(other: Clause | CourseRule | Claim): boolean;
	toString(): string;
	applies_to(other: any): boolean;
}

class ClauseTypeError extends TypeError {}
export function loadClause(
	data: object | { $and: object[] } | { $or: object[] },
): Clause {
	if (Object.is(data, Object)) {
		throw new ClauseTypeError(
			`expected ${JSON.stringify(data)} to be a dictionary`,
		);
	}

	if ("$and" in data) {
		assert(Object.keys(data).length === 1);
		return new AndClause(data["$and"]);
	} else if ("$or" in data) {
		assert(Object.keys(data).length === 1);
		return new OrClause(data["$or"]);
	} else {
		let clauses = Object.entries(data).map(([key, value]: [string, any]) => {
			return new SingleClause(key, value);
		});

		if (clauses.length === 1) {
			return clauses[0];
		}

		return new AndClause(clauses);
	}
}

export class AndClause implements Clause {
	readonly children: ReadonlyArray<Clause> = [];

	constructor(data: any[]) {
		this.children = data.map(loadClause);
	}

	*[Symbol.iterator]() {
		yield* this.children;
	}

	// Checks if this clause applies to the same items as the other clause,
	// when used as part of a multicountable ruleset.
	mc_applies_same(other: Clause | CourseRule | Claim): boolean {
		return this.children.some(clause => clause.mc_applies_same(other));
	}

	toString() {
		return this.children.map(c => c.toString()).join(" and ");
	}

	applies_to(other: any): boolean {
		return this.children.every(clause => clause.applies_to(other));
	}
}

export class OrClause implements Clause {
	readonly children: ReadonlyArray<Clause> = [];

	constructor(data: any[]) {
		this.children = data.map(loadClause);
	}

	*[Symbol.iterator]() {
		yield* this.children;
	}

	// Checks if this clause applies to the same items as the other clause,
	// when used as part of a multicountable ruleset.
	mc_applies_same(other: Clause | CourseRule | Claim): boolean {
		return this.children.some(clause => clause.mc_applies_same(other));
	}

	toString() {
		return this.children.map(c => c.toString()).join(" or ");
	}

	applies_to(other: any): boolean {
		return this.children.some(clause => clause.applies_to(other));
	}
}

export class SingleClause implements Clause {
	readonly key: string;
	readonly expected: any;
	readonly operator: Operator;

	constructor(key: string, value: any) {
		assert(Object.keys(value).length === 1);
		let op = Object.keys(value)[0];

		this.operator = operatorFromString(op);
		this.expected = value[op];

		if (key == "subjects") {
			key = "subject";
		} else if (key == "attribute") {
			key = "attributes";
		} else if (key == "gereq") {
			key = "gereqs";
		}

		this.key = key;
	}

	compare(to_value: any): boolean {
		logger.debug(`clause/compare ${to_value} against ${this}`);

		if (Array.isArray(this.expected) && this.operator != Operator.In) {
			throw new TypeError(
				`operator ${this.operator} does not accept a list as the expected value`,
			);
		} else if (!Array.isArray(this.expected) && this.operator == Operator.In) {
			throw new TypeError(
				"expected a list of values to compare with $in operator",
			);
		}

		if (Array.isArray(to_value)) {
			if (to_value.length === 0) {
				logger.debug("clause/compare: skipped (empty to_value)");
				return false;
			}

			if (to_value.length === 1) {
				to_value = to_value[0];
			} else {
				logger.debug("clause/compare: beginning recursive comparison");
				return to_value.some(this.compare);
			}
		}

		if (this.operator == Operator.In) {
			logger.debug("clause/compare/$in: beginning inclusion check");
			return this.expected.some((v: any) => v === to_value);
		}

		let expected = this.expected;
		if (
			typeof to_value === "string" &&
			(typeof this.expected === "number" || Decimal.isDecimal(this.expected))
		) {
			expected = this.expected.toString();
		}

		let result = false;
		switch (this.operator) {
			case Operator.LessThan:
				result = expected < to_value;
				break;
			case Operator.LessThanOrEqualTo:
				result = expected <= to_value;
				break;
			case Operator.EqualTo:
				result = expected == to_value;
				break;
			case Operator.NotEqualTo:
				result = expected != to_value;
				break;
			case Operator.GreaterThanOrEqualTo:
				result = expected >= to_value;
				break;
			case Operator.GreaterThan:
				result = expected > to_value;
				break;
			default:
				throw new TypeError(`unknown comparison function ${this.operator}`);
		}

		logger.debug(
			`clause/compare: '${expected}' ${this.operator} '${to_value}'; ${result}`,
		);
		return result;
	}

	// Checks if this clause applies to the same items as the other clause,
	// when used as part of a multicountable ruleset.
	mc_applies_same(other: Clause | CourseRule | Claim): boolean {
		if (other instanceof AndClause || other instanceof OrClause) {
			return other.mc_applies_same(this);
		}

		if (!(other instanceof SingleClause)) {
			return false;
		}

		return (
			this.key == other.key &&
			this.expected == other.expected &&
			this.operator == other.operator
		);
	}

	applies_to(other: any): boolean {
		return this.compare(other);
	}

	toString() {
		return `"${this.key}" ${this.operator} "${this.expected}"`;
	}
}

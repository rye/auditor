import { logger } from "../../logging";
import { Operator, operatorFromString } from "../../clause";
import assert from "assert";
import { range } from "../../lib";
import { RequirementContext } from "../../requirement";

export interface Assertion {
	apply(value: any): boolean;
	validate(_: { ctx: RequirementContext }): void;
	minmax(items: readonly any[]): { lo: number; hi: number };
	range(items: readonly any[]): Iterable<number>;
	get_min_value(): string | number;
	get_max_value(): string | number;
}

export function loadAssertion(data: any): Assertion {
	if ("$and" in data) {
		assert(Object.keys(data).length === 1);
		return new AndAssertion(data["$and"]);
	} else if ("or" in data) {
		assert(Object.keys(data).length === 1);
		return new OrAssertion(data["or"]);
	} else {
		return new SingleAssertion(data);
	}
}

export class AndAssertion implements Assertion {
	readonly children: ReadonlyArray<Assertion>;

	constructor(data: ReadonlyArray<any>) {
		this.children = data.map(loadAssertion);
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		this.children.forEach(a => a.validate({ ctx }));
	}

	apply(value: any) {
		return this.children.every(child => child.apply(value));
	}

	minmax(items: readonly any[]): { lo: number; hi: number } {
		let ranges = this.children.map(c => c.minmax(items));
		let los = ranges.map(r => r.lo);
		let his = ranges.map(r => r.hi);
		let lo = Math.min(...los);
		let hi = Math.max(...his);
		return { lo, hi };
	}

	range(items: readonly any[]): Iterable<number> {
		// count(courses) > 6 AND count(departments) > 7
		// output: min=6, max=7
		let { lo, hi } = this.minmax(items);
		return range(lo, hi);
	}

	get_min_value() {
		return Math.min(...(this.children.map(c => c.get_min_value()) as number[]));
	}

	get_max_value() {
		return Math.min(...(this.children.map(c => c.get_max_value()) as number[]));
	}
}

export class OrAssertion implements Assertion {
	readonly children: ReadonlyArray<Assertion>;

	constructor(data: ReadonlyArray<any>) {
		this.children = data.map(loadAssertion);
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		this.children.forEach(a => a.validate({ ctx }));
	}

	apply(value: any) {
		return this.children.some(child => child.apply(value));
	}

	minmax(items: readonly any[]): { lo: number; hi: number } {
		let ranges = this.children.map(c => c.minmax(items));
		let los = ranges.map(r => r.lo);
		let his = ranges.map(r => r.hi);
		let lo = Math.min(...los);
		let hi = Math.max(...his);
		return { lo, hi };
	}

	range(items: readonly any[]): Iterable<number> {
		// count(courses) > 6 AND count(departments) > 7
		// output: min=6, max=7
		let { lo, hi } = this.minmax(items);
		return range(lo, hi);
	}

	get_min_value() {
		return Math.min(...(this.children.map(c => c.get_min_value()) as number[]));
	}

	get_max_value() {
		return Math.min(...(this.children.map(c => c.get_max_value()) as number[]));
	}
}

export class SingleAssertion {
	readonly command:
		| "count"
		| "sum"
		| "minimum"
		| "maximum"
		| "stored"
		| "average";
	readonly source: string;
	readonly operator: Operator;
	readonly compare_to: string | number;

	constructor(data: any) {
		let keys = Object.keys(data);

		assert(keys.length == 1, "expected exactly one key");

		let rex = /(count|sum|minimum|maximum|stored|average)\((.*)\)/;

		let k = keys[0];

		let m = k.match(rex);
		if (!m) {
			throw new TypeError(`expected "${k}" to match ${rex}`);
		}

		let val = data[k];

		let valueKeys = Object.keys(val);
		assert(valueKeys.length === 1);

		let op = valueKeys[0];

		this.command = m[1] as any;
		this.source = m[2];
		this.operator = operatorFromString(op);
		this.compare_to = val[op];
	}

	validate({ ctx }: { ctx: RequirementContext }) {
		assert(
			["count", "sum", "minimum", "maximum", "stored", "average"].includes(
				this.command,
			),
			`expected "${this.command}" to match "count", "sum", "minimum", "maximum", "stored", "average"`,
		);

		switch (this.command) {
			case "count":
				assert(
					["courses", "areas", "performances", "terms", "semesters"].includes(
						this.source,
					),
				);
				break;
			case "sum":
				assert(["grades", "credits"].includes(this.source));
				break;
			case "average":
				assert(["grades", "credits"].includes(this.source));
				break;
			case "minimum":
			case "maximum":
				assert(
					["terms", "semesters", "grades", "credits"].includes(this.source),
				);
				break;
			case "stored":
				// # TODO: assert that the stored lookup exists
				break;
		}
	}

	get_min_value() {
		let compare_to = this.compare_to;

		if (!Number.isFinite(compare_to as any)) {
			throw new TypeError(
				`compare_to must be numeric to be used in min(); was ${typeof compare_to} (${compare_to}`,
			);
		}

		return compare_to;
	}

	get_max_value() {
		let compare_to = this.compare_to;

		if (!Number.isFinite(compare_to as any)) {
			throw new TypeError(
				`compare_to must be numeric to be used in max(); was ${typeof compare_to} (${compare_to}`,
			);
		}

		return compare_to;
	}

	/**
	 * @description find the smallest and largest numbers of items
	 *   which can satisfy the rule, and return a range between them
	 */
	range(items: readonly any[]): Iterable<number> {
		let { lo, hi } = this.minmax(items);
		return range(lo, hi);
	}

	minmax(items: readonly any[]): { lo: number; hi: number } {
		let compare_to: any = this.compare_to;

		if (!Number.isFinite(compare_to)) {
			throw new TypeError(
				`compare_to must be numeric to be used in a range; was ${typeof compare_to} (${compare_to}`,
			);
		}

		let hi, lo;
		if (this.operator == Operator.LessThanOrEqualTo) {
			hi = compare_to;
			// # lo = items.length
			lo = 0;
		} else if (this.operator == Operator.LessThan) {
			hi = compare_to - 1;
			// # lo = items.length
			lo = 0;
		} else if (this.operator == Operator.GreaterThan) {
			lo = compare_to + 1;
			hi = Math.max(items.length, lo + 1);
		} else if (this.operator == Operator.GreaterThanOrEqualTo) {
			lo = compare_to;
			hi = Math.max(items.length, lo + 1);
		} else if (this.operator == Operator.EqualTo) {
			hi = compare_to + 1;
			lo = compare_to;
		}

		if (hi <= lo) {
			logger.info(`expected hi=${hi} > lo=${lo}`);
		}

		return { lo, hi };
	}

	apply(value: any): boolean {
		let compare_to: any = this.compare_to;

		if (!Number.isFinite(compare_to)) {
			throw new TypeError(
				`compare_to must be numeric to be used in apply(); was ${typeof compare_to} (${compare_to}`,
			);
		}

		if (this.operator == Operator.LessThanOrEqualTo) {
			return value <= compare_to;
		} else if (this.operator == Operator.LessThan) {
			return value < compare_to;
		} else if (this.operator == Operator.GreaterThan) {
			return value > compare_to;
		} else if (this.operator == Operator.GreaterThanOrEqualTo) {
			return value >= compare_to;
		} else if (this.operator == Operator.EqualTo) {
			return value == compare_to;
		} else {
			throw new Error("um");
		}
	}
}

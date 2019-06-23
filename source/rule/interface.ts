import { RequirementContext, ClaimAttempt } from "../requirement";
import { Solution } from "../solution";

export interface Rule {
	solutions(_: {
		ctx: RequirementContext;
		path: string[];
	}): IterableIterator<Solution>;
	validate(_: { ctx: RequirementContext }): void;
	estimate(_: { ctx: RequirementContext }): number;

	state(): "rule";
	claims(): ReadonlyArray<ClaimAttempt>;
	rank(): 0;
	ok(): boolean;
}

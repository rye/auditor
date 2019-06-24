import { RequirementContext, ClaimAttempt } from "../requirement";
import { Result } from "../result";

export interface Solution {
	state(): "solution";
	claims(): ReadonlyArray<ClaimAttempt>;
	rank(): 0;
	ok(): boolean;
	audit(_: { ctx: RequirementContext; path: (string | number)[] }): Result;

	toJSON(): {
		type: string;
		state: string;
		status: string;
		ok: boolean;
		rank: number;
		claims: readonly ClaimAttempt[];
	};
}

import { ClaimAttempt } from "../requirement";

export interface Result {
	state(): "result";
	claims(): readonly ClaimAttempt[];
	ok(): boolean;
	rank(): number;

	toJSON(): {
		type: string;
		state: string;
		status: string;
		ok: boolean;
		rank: number;
		claims: readonly ClaimAttempt[];
	};
}

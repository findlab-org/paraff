
import { Fraction } from "../fraction";



namespace ABC {
	type Token = string;


	interface KeyValue {
		name: string;
		value: any;
	};


	export interface ControlTerm {
		control: KeyValue;
	};


	interface Grace {
		grace: boolean;
		acciaccatura: Token;
		events: EventTerm[];
	};


	interface Comment {
		comment: string;
	};


	export interface Articulation {
		articulation: Token;
		scope?: '<' | '>';
	};


	export type Expressive =
		| Articulation
		| { express: Token }   // for tokens like '(' , ')', '.' , '-' stored as { express: $1 }
	;


	export interface TextTerm {
		text: string;
	}


	export interface Pitch {
		acc: number | null;      // accidentals: '^' | '_' | '=' or null
		phonet: Token; // underlying letter token or rest
		quotes: number | null;   // number of single/double quotes: positive for sup, negative for sub, null if none
	};


	export interface Chord {
		pitches: Pitch[];
		tie?: any; // tie present in helper but not produced in grammar actions; keep any
	};


	export type PitchOrChord = Pitch | Chord;


	export interface EventData {
		chord: Array<PitchOrChord>; // grammar uses pitch_or_chord -> returns an array [$1]
		duration?: Fraction;
	};


	export interface EventTerm {
		event: EventData;
		broken?: number;
	};


	export type MusicTerm =
		| Expressive
		| TextTerm
		| EventTerm
		| Grace
		| ControlTerm;


	type Header = KeyValue | Comment;


	export interface BarPatch {
		control: { [k: string]: any };
		terms: MusicTerm[];
		bar: Token;
	};


	export interface KeySignature {
		root: string;
		mode?: string;
	};


	interface Measure {
		index: number;
		voices: BarPatch[];
	};


	interface Body {
		measures: Measure[];
	};


	export interface Tune {
		header: Header[];
		body: Body;
	};


	export type Document = Tune[];
}



export {
	ABC,
};

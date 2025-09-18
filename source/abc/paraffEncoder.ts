
import { Token } from "../paraff";
import { Fraction } from "../fraction";
import { ABC } from "./abc";



type ParaffVoice = Token[];


interface ParaffMeasure {
	key: number|null;
	timeSig: Fraction|null;

	voices: ParaffVoice[];

	description: Set<string>;
	//graceChainN: number;
};


const PhonetMapping: Record<string, Token> = {
	a: Token.a,
	b: Token.b,
	c: Token.c,
	d: Token.d,
	e: Token.e,
	f: Token.f,
	g: Token.g,
	A: Token.a,
	B: Token.b,
	C: Token.c,
	D: Token.d,
	E: Token.e,
	F: Token.f,
	z: Token.a,
};


const AccidentalMapping: Record<number, Token> = {
	[1]: Token.As,
	[2]: Token.Ass,
	[-1]: Token.Af,
	[-2]: Token.Aff,
};


const abcToParaff = (document: ABC.Document): ParaffMeasure[] => {
	const measures: ParaffMeasure[] = [];

	for (const measure of document.body.measures) {
		const paraffMeasure: ParaffMeasure = {
			key: null,
			timeSig: null,
			voices: [],
			description: new Set(),
		};

		for (const [vi, voice] of measure.voices.entries()) {
			const tokens: Token[] = [];

			//tokens.push(Token.BOM);

			for (const term of voice.terms) {
				if ("event" in term) {
					tokens.push(...eventToTokens(term.event));
				}
				else if ("grace" in term) {
					// Grace notes
					for (const gEvent of term.events) {
						tokens.push(Token.G);
						if ("event" in gEvent)
							tokens.push(...eventToTokens(gEvent.event));
					}
				}
				else if ("articulation" in term || "express" in term) {
					// Expressive articulation
					tokens.push(Token.Dot);
				}
				else if ("text" in term) {
					// TextTerm: ignore
				}
				else if ("control" in term) {
					// ControlTerm: 可以在这里解析 Key/TimeSig
					if (term.control.name === "key") {
						paraffMeasure.key = term.control.value;
					}
					if (term.control.name === "M") {
						paraffMeasure.timeSig = term.control.value;
					}
				}
			}

			//tokens.push(Token.EOM);
			paraffMeasure.voices[vi] = tokens;
		}

		measures.push(paraffMeasure);
	}

	return measures;
};


const eventToTokens = (event: ABC.EventData): Token[] => {
	const tokens: Token[] = [];

	for (const chordOrPitch of event.chord) {
		if ("pitches" in chordOrPitch) {
			for (const pitch of chordOrPitch.pitches)
				tokens.push(...pitchToTokens(pitch));
		}
		else
			tokens.push(...pitchToTokens(chordOrPitch));
	}
	if (event.duration)
		tokens.push(...durationToTokens(event.duration));

	return tokens;
};


const pitchToTokens = (pitch: ABC.Pitch): Token[] => {
	const result: Token[] = [];
	result.push(PhonetMapping[pitch.phonet]);
	if (pitch.acc) {
		const acc = AccidentalMapping[pitch.acc as number];
		result.push(acc);
	}
	// TODO: determine acc by key signature in context

	if (pitch.quotes) {
		if (pitch.quotes > 0) {
			for (let i = 0; i < pitch.quotes; i++)
				result.push(Token.Osup);
		}
		else {
			for (let i = 0; i < -pitch.quotes; i++)
				result.push(Token.Osub);
		}
	}
	return result;
}


const durationToTokens = (frac: Fraction): Token[] => {
	const result: Token[] = [];
	const { numerator, denominator } = frac;

	const denomMap: Record<number, Token> = {
		1: Token.D1,
		2: Token.D2,
		4: Token.D4,
		8: Token.D8,
		16: Token.D16,
		32: Token.D32,
	};

	if (denominator in denomMap) {
		for (let i = 0; i < numerator; i++) {
			result.push(denomMap[denominator]);
		}
	}
	return result;
}



export {
	abcToParaff,
};

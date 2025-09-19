
import { Token, PromptToken, isTokenOf, TokenKey, TokenStaff, TokenOctaveShift, TokenNumerator, TokenDenominator,
	TokenDivision, TokenTimewarp, TokenTremolo, TokenTremoloCast } from "../paraff/vocab";
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


interface ABCContext {
	keySig: number;
	timeSig: Fraction;
	baseDivision: number;
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


const identifyKeySignature = (key: ABC.KeySignature): number => {
	const ROOTS = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
	const offset = (key.mode && key.mode === "minor") ? -10 : -7;

	return ROOTS.indexOf(key.root) + offset;
};


const pitchToTokens = (ctx: ABCContext, pitch: ABC.Pitch): Token[] => {
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
};


const durationToTokens = (ctx: ABCContext, frac: Fraction): Token[] => {
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
};


const eventToTokens = (ctx: ABCContext, event: ABC.EventData): Token[] => {
	const tokens: Token[] = [];

	for (const chordOrPitch of event.chord) {
		if ("pitches" in chordOrPitch) {
			for (const pitch of chordOrPitch.pitches)
				tokens.push(...pitchToTokens(ctx, pitch));
		}
		else
			tokens.push(...pitchToTokens(ctx, chordOrPitch));
	}
	if (event.duration)
		tokens.push(...durationToTokens(ctx, event.duration));

	return tokens;
};


const tuneToParaffMeasures = (tune: ABC.Tune): ParaffMeasure[] => {
	const measures: ParaffMeasure[] = [];
	const ctx: ABCContext = {
		keySig: 0,
		timeSig: { numerator: 4, denominator: 4 },
		baseDivision: 3,
	};

	tune.header.forEach(header => {
		if (!("name" in header))
			return;

		switch (header.name) {
		case "K":
			ctx.keySig = identifyKeySignature(header.value as ABC.KeySignature);

			break;
		case "L":
			console.assert((header.value as Fraction).numerator === 1);
			ctx.baseDivision = Math.log2((header.value as Fraction).denominator);

			break;
		case "M":
			ctx.timeSig = header.value;

			break;
		}
	});

	for (const measure of tune.body.measures) {
		const paraffMeasure: ParaffMeasure = {
			key: ctx.keySig,
			timeSig: ctx.timeSig,
			voices: [],
			description: new Set(),
		};

		for (const [vi, voice] of measure.voices.entries()) {
			const tokens: Token[] = [];

			//tokens.push(Token.BOM);

			for (const term of voice.terms) {
				if ("event" in term) {
					tokens.push(...eventToTokens(ctx, term.event));
				}
				else if ("grace" in term) {
					// Grace notes
					for (const gEvent of term.events) {
						tokens.push(Token.G);
						if ("event" in gEvent)
							tokens.push(...eventToTokens(ctx, gEvent.event));
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
					switch (term.control.name) {
					case "key":
						ctx.keySig = identifyKeySignature(term.control.value);
						paraffMeasure.key = ctx.keySig;

						break;
					case "M":
						ctx.timeSig = term.control.value;
						paraffMeasure.timeSig = ctx.timeSig;

						break;
					case "L":
						console.assert(term.control.value.numerator === 1);
						ctx.baseDivision = Math.log2(term.control.value.denominator);

						break;
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


interface DescriptedSentence {
	description: string[];
	sentence: Token[];
};


const tokenizeFraction = (fraction: Fraction): Token[] => [TokenNumerator[fraction.numerator], TokenDenominator[fraction.denominator]];


const abcToParaff = (document: ABC.Document): DescriptedSentence[] => {
	const measures = document.map(tuneToParaffMeasures).flat(1);

	return measures.map(measure => {
		const voices = measure.voices.filter(v => v.length)
			; //.filter(v => !isPureSpaceVoice(v));	// ignore pure space voice
		const tokens = voices.map((v, i) => i ? [Token.VB, ...v.filter(Boolean)] : v).flat(1);

		if (measure.timeSig)
			tokens.unshift(...tokenizeFraction(measure.timeSig));
		if (Number.isInteger(measure.key))
			tokens.unshift(TokenKey[measure.key!]);

		const sentence = [
			Token.BOM,
			...tokens,
			Token.EOM,
		];

		const staffTokens = tokens.filter(isTokenOf(TokenStaff));
		const staffSet = new Set(staffTokens);
		const maxStaff = Math.max(...staffTokens);
		const polyvoice = Object.values(TokenStaff).some(s => voices.filter(voice => voice.some(t => t === s)).length > 1);
		const divisionTokens = tokens.filter(isTokenOf(TokenDivision));
		const maxDivision = Math.max(...divisionTokens);
		const hasGrace = tokens.some(t => t === Token.G);
		const hasTremolo = tokens.some(isTokenOf(TokenTremolo)) || tokens.some(isTokenOf(TokenTremoloCast));
		const hasDot = tokens.some(t => t === Token.Dot);
		const hasTimewarp = tokens.some(isTokenOf(TokenTimewarp));
		const hasOctaveShift = tokens.some(isTokenOf(TokenOctaveShift));
		const crossStaves = voices.some(voice => new Set(voice.filter(isTokenOf(TokenStaff))).size > 1);
		const complicated = voices.length > staffSet.size * 2
			|| voices.length > staffSet.size && crossStaves
			|| new Set(divisionTokens).size > 4;

		const description = Array.from(measure.description);

		switch (maxStaff) {
		case Token.S1:
			description.push(PromptToken.SingleStaff);
			break;
		case Token.S2:
			description.push(PromptToken.DoubleStaff);
			break;
		case Token.S3:
			description.push(PromptToken.TripleStaff);
			break;
		}

		description.push(polyvoice ? PromptToken.PolyVoice : PromptToken.MonoVoice);

		switch (maxDivision) {
		case Token.D1:
			description.push(PromptToken.Rhythm1);
			break;
		case Token.D2:
			description.push(PromptToken.Rhythm2);
			break;
		case Token.D4:
			description.push(PromptToken.Rhythm4);
			break;
		case Token.D8:
			description.push(PromptToken.Rhythm8);
			break;
		case Token.D16:
			description.push(PromptToken.Rhythm16);
			break;
		case Token.D32:
			description.push(PromptToken.Rhythm32);
			break;
		default:
			description.push(PromptToken.Rhythm64);
			break;
		}

		description.push(hasGrace ? PromptToken.Grace : PromptToken.noGrace);
		description.push(hasTremolo ? PromptToken.Tremolo : PromptToken.noTremolo);
		description.push(hasDot ? PromptToken.Dot : PromptToken.noDot);
		description.push(hasTimewarp ? PromptToken.Timewarp : PromptToken.noTimewarp);
		description.push(hasOctaveShift ? PromptToken.OctaveShift : PromptToken.noOctaveShift);

		if (crossStaves)
			description.push(PromptToken.CrossStaves);

		if (complicated)
			description.push(PromptToken.Complicated);

		return {
			sentence,
			description,
		};
	});
};



export {
	abcToParaff,
};

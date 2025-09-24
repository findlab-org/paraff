
import { Token, PromptToken, isTokenOf, TokenKey, TokenStaff, TokenOctaveShift, TokenNumerator, TokenDenominator,
	TokenDivision, TokenTimewarp, TokenTremolo, TokenTremoloCast, TokenAccidental, TokenPhonet } from "../paraff/vocab";
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


interface TupletContext {
	n: number;
	notes: number;
	ticks: number;	// in 128th notes
};


interface ABCContext {
	keySig: number;
	timeSig: Fraction;
	baseDivision: number;
	y: number;
	lastBroken: number | null;
	voice: string | null;
	staff: number;
	pendingExpresses: string[];
	tuplet?: TupletContext;
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
	G: Token.g,
	z: Token.a,
	x: Token.a,
};


const ExpressiveMapping: Record<string, Token> = {
	"(": Token.EslurL,
	")": Token.EslurR,
	"-": Token.Etie,
	"arpeggio": Token.Earp,
	"trill": Token.Etr,
	"fermata": Token.Efer,
	"shortfermata": Token.Esf,
	".": Token.Est,
	"staccato": Token.Est,
	"staccatissimo": Token.Estm,
	"wedge": Token.Estm,
	"accent": Token.Eac,
	"mordent": Token.Emor,
	"~": Token.Emor,
	"prall": Token.Epr,
	"pralltriller": Token.Epr,
	"turn": Token.Eturn,
	"portato": Token.Epor,
	"_": Token.Eten,
	"tenuto": Token.Eten,
	"^": Token.Emar,
	"marcato": Token.Emar,
	"crescendo(": Token.Ecre,
	"<(": Token.Ecre,
	"diminuendo(": Token.Edim,
	">(": Token.Edim,
	"crescendo)": Token.Ecds,
	"<)": Token.Ecds,
	"diminuendo)": Token.Ecds,
	">)": Token.Ecds,
	"ped": Token.Eped,
	"ped-up": Token.EpedUp,
};


const ClefMapping: Record<string, Token> = {
	treble: Token.Cg,
	bass: Token.Cf,
	tenor: Token.Cc,
};


const identifyKeySignature = (key: ABC.KeySignature): number => {
	const ROOTS = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
	const offset = (key.mode && key.mode === "minor") ? -10 : -7;

	return ROOTS.indexOf(key.root) + offset;
};


const pitchToY = (pitch: ABC.Pitch): number => {
	const isUpcase = pitch.phonet === pitch.phonet.toUpperCase();
	const octave = (isUpcase ? 0 : 1) + pitch.quotes;
	const step = "CDEFGAB".indexOf(pitch.phonet.toUpperCase());

	return step + octave * 7;
};


const pitchToTokens = (ctx: ABCContext, pitch: ABC.Pitch): Token[] => {
	const result: Token[] = [];

	const phonet = pitch.phonet.toUpperCase();
	const y = pitchToY(pitch);
	const isRest = "xz".includes(pitch.phonet);

	result.push(PhonetMapping[pitch.phonet]);

	if (pitch.acc) {
		const acc = TokenAccidental[pitch.acc as number];
		if (acc)
			result.push(acc);
	}
	else if (!isRest) {
		// determine acc by key signature in context
		const SHARP_PHONETS = "_FCGDAEB";
		const FLAT_PHONETS = "_BEADGCF";
		if (ctx.keySig > 0) {
			if (SHARP_PHONETS.indexOf(phonet) <= ctx.keySig)
				result.push(Token.As);
		}
		else if (ctx.keySig < 0) {
			if (FLAT_PHONETS.indexOf(phonet) <= -ctx.keySig)
				result.push(Token.Af);
		}
	}

	if (isRest) {
		if (Math.abs(y - ctx.y) >= 4) {
			for (let yy = y; yy - ctx.y >= 4; yy -= 7)
				result.push(Token.Osup);

			for (let yy = y; ctx.y - yy >= 4; yy += 7)
				result.push(Token.Osub);
		}
		ctx.y = y;
	}

	if (pitch.tie && !ctx.pendingExpresses.includes("-"))
		ctx.pendingExpresses.push("-");

	return result;
};


const durationToTokens = (ctx: ABCContext, duration: Fraction | undefined, broken: number | null, isGrace: boolean): Token[] => {
	const { numerator, denominator = 1 } = duration || { numerator: 1, denominator: 1 };

	const is2Power = (n: number): boolean => (n & (n - 1)) === 0 && n > 0;

	let n_odd = numerator;
	while (n_odd % 2 === 0)
		n_odd /= 2;

	console.assert(is2Power(n_odd + 1), "invalid numerator in duration:", duration);
	console.assert(is2Power(denominator), "invalid denominator in duration:", duration);

	const dots = Math.log2(n_odd + 1) - 1 + Math.max(0, broken || 0) - Math.min(0, ctx.lastBroken || 0);
	const division = ctx.baseDivision + Math.log2(denominator) - Math.floor(Math.log2(numerator)) + Math.max(Math.max(0, ctx.lastBroken || 0), -Math.min(0, broken || 0));

	const tokens: Token[] = [];

	if (ctx.tuplet) {
		const firstW = ctx.tuplet.notes === 0;

		ctx.tuplet.notes++;
		ctx.tuplet.ticks += Math.round((16 * numerator) / denominator);

		if (!firstW)
			tokens.push(Token.W);
		else
			tokens.push(TokenTimewarp[ctx.tuplet.n - 1] || Token.Wx);

		if (ctx.tuplet.notes > ctx.tuplet.n / 2) {
			const q = ctx.tuplet.ticks / ctx.tuplet.n;
			if (Math.floor(q) === q)
				ctx.tuplet = undefined;
		}
	}

	tokens.push(TokenDivision[division])
	for (let d = dots; d > 0; d--)
		tokens.push(Token.Dot);

	return tokens;
};


const eventToTokens = (ctx: ABCContext, term: ABC.EventTerm, isGrace: boolean = false): Token[] => {
	const event = term.event;
	let isRest = false;

	const tokens: Token[] = [];

	for (const pitch of event.chord.pitches) {
		tokens.push(...pitchToTokens(ctx, pitch));

		isRest = "xz".includes(event.chord.pitches[0].phonet);
	}

	tokens.push(...durationToTokens(ctx, event.duration, term.broken, isGrace));

	if (isRest)
		tokens.push(event.chord.pitches[0].phonet === "x" ? Token.RSpace : Token.Rest);

	return tokens;
};


const tuneToParaffMeasures = (tune: ABC.Tune): ParaffMeasure[] => {
	const measures: ParaffMeasure[] = [];
	const ctx: ABCContext = {
		keySig: 0,
		timeSig: { numerator: 4, denominator: 4 },
		baseDivision: 3,
		y: 0,
		lastBroken: null,
		voice: null,
		staff: 1,
		pendingExpresses: [],
	};

	const voiceMapping: Record<string, Record<string, any>> = {};

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
		case "V": {
			const voice = header.value;
			voiceMapping[voice.name] = {
				clef: voice.clef,
				...voice.properties,
			};
		}

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

			const checkStaff = () => {
				if (tokens.length === 0)
					tokens.push(TokenStaff[ctx.staff - 1]);
			};

			for (const term of voice.terms) {
				if ("event" in term) {
					checkStaff();
					tokens.push(...eventToTokens(ctx, term));

					for (const pe of ctx.pendingExpresses)
						if (ExpressiveMapping[pe])
							tokens.push(ExpressiveMapping[pe]);
					ctx.pendingExpresses = [];

					ctx.lastBroken = term.broken;
				}
				else if ("grace" in term) {
					// Grace notes
					for (const gEvent of term.events) {
						tokens.push(Token.G);
						if ("event" in gEvent) {
							checkStaff();
							tokens.push(...eventToTokens(ctx, gEvent, true));
						}
					}
				}
				else if ("articulation" in term || "express" in term) {
					const value = ((term as any).articulation || (term as any).express) + ((term as any).scope || "");
					if ((term as any).scope === "(")
						ctx.pendingExpresses.push(value);
					else {
						switch (value) {
						case "ped":
						case "(":
						case ".":
						case "prall":
						case "trill":
							ctx.pendingExpresses.push(value);

							break;
						default:
							if (ExpressiveMapping[value])
								tokens.push(ExpressiveMapping[value]);
						}
					}
				}
				else if ("text" in term) {
					// TextTerm: ignore
				}
				else if ("control" in term) {
					switch (term.control.name) {
					case "K":
						if (term.control.value.clef)
							tokens.push(ClefMapping[term.control.value.clef]);
						else {
							ctx.keySig = identifyKeySignature(term.control.value);
							paraffMeasure.key = ctx.keySig;
						}

						break;
					case "M":
						ctx.timeSig = term.control.value;
						paraffMeasure.timeSig = ctx.timeSig;

						break;
					case "L":
						console.assert(term.control.value.numerator === 1);
						ctx.baseDivision = Math.log2(term.control.value.denominator);

						break;
					case "V": {
						ctx.voice = term.control.value;
						const voice = voiceMapping[ctx.voice];
						if (voice) {
							if (voice.staff)
								ctx.staff = voice.staff;
							else if (voice.clef)
								ctx.staff = voice.clef === "bass" ? 2 : 1;
						}
					}

						break;
					}
				}
				else if ("tuplet" in term) {
					ctx.tuplet = {n: term.tuplet, notes: 0, ticks: 0};
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


const isPureSpaceVoice = (tokens: Token[]): boolean => {
	const rt = [...tokens].reverse();
	const rip = rt.findIndex(isTokenOf(TokenPhonet));
	const rid = rt.findIndex(isTokenOf(TokenDivision));
	if (rip >= 0 && (rip < rid || rid < 0))	// incomplete chord at tail
		return false;

	const ds = tokens.filter(isTokenOf(TokenDivision)).length;
	const ss = tokens.filter(t => t === Token.RSpace).length;

	return ss >= ds;
};


const abcToParaff = (document: ABC.Document): DescriptedSentence[] => {
	const measures = document.map(tuneToParaffMeasures).flat(1);

	return measures.map(measure => {
		const voices = measure.voices.filter(v => v.length)
			.filter(v => !isPureSpaceVoice(v));	// ignore pure space voice
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

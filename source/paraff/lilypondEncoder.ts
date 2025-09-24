
import { ParaffDocument, ParaffDoc } from "./paraff";
import { ExpressiveMark } from "./types";
import { frac } from "../fraction";



const KEYS = {
	[0]: "c \\major",
	[1]: "g \\major",
	[2]: "d \\major",
	[3]: "a \\major",
	[4]: "e \\major",
	[5]: "b \\major",
	[6]: "fs \\major",
	[-1]: "f \\major",
	[-2]: "bf \\major",
	[-3]: "ef \\major",
	[-4]: "af \\major",
	[-5]: "df \\major",
	[-6]: "gf \\major",
};

const CLEFS = {
	Cf: "bass",
	Cc: "C",
	Cg: "treble",
};

const OATTVAS = {
	O0: 0,
	Ova: 1,
	Ovb: -1,
};

const BEAMS = {
	Bl: "[",
	Br: "]",
};

const STEM_DIRECTIONS = {
	Mu: "\\stemUp",
	Md: "\\stemDown",
};

export const MARKS = {
	[ExpressiveMark.SlurL]:				"(",
	[ExpressiveMark.SlurR]:				")",
	[ExpressiveMark.Tie]:				"~",
	[ExpressiveMark.Arpeggio]:			"\\arpeggio",
	[ExpressiveMark.Trill]:				"\\trill",
	[ExpressiveMark.Fermata]:			"\\fermata",
	[ExpressiveMark.ShortFermata]:		"\\shortfermata",
	[ExpressiveMark.Staccato]:			"-.",
	[ExpressiveMark.Staccatissimo]:		"-!",
	[ExpressiveMark.Accent]:			"->",
	[ExpressiveMark.Mordent]:			"\\mordent",
	[ExpressiveMark.Prall]:				"\\prall",
	[ExpressiveMark.Turn]:				"\\turn",
	[ExpressiveMark.Portato]:			"-_",
	[ExpressiveMark.Tenuto]:			"--",
	[ExpressiveMark.Marcato]:			"-^",
	[ExpressiveMark.Crescendo]:			"\\<",
	[ExpressiveMark.Diminuendo]:		"\\>",
	[ExpressiveMark.CreDimStop]:		"\\!",
	[ExpressiveMark.SustainOn]:			"\\sustainOn",
	[ExpressiveMark.SustainOff]:		"\\sustainOff",
};


const DYNAMICS = [
	ExpressiveMark.f, ExpressiveMark.p, ExpressiveMark.m, ExpressiveMark.r, ExpressiveMark.s, ExpressiveMark.z,
];

export const DYNAMIC_WORDS = [
	"ppppp", "pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff", "fffff", "fp", "sf", "sff", "sp", "spp", "sfz", "rfz", "n",
];


interface RenderOptions {
	paper: {
		width: number|string;
		height: number|string;
	};
	fontSize: number|string;
	withMIDI?: boolean|string;
	headers?: Record<string, string>;
	autoBeaming?: string;
};


const ENGLISH_NUMBERS = [
	"Zero",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
	"Eleven",
	"Twelve",
];


const renderHeaders = (headers?: Record<string, string>): string => {
	if (!headers)
		return "";

	return "\n" + Object.entries(headers).map(([key, value]) => `\t${key} = ${value}`).join("\n");
};


const renderDoc = (music, options: RenderOptions) => `\\version "2.20.0" 

\\language "english" 

\\header {
	tagline = ##f${renderHeaders(options.headers)}
}


#(set-global-staff-size ${options.fontSize}) 

\\paper {
	paper-width = ${options.paper.width}
	paper-height = ${options.paper.height}
	ragged-last = ##t
	ragged-last-bottom = ##f
}


\\layout {
	\\context {
		\\Score 
		autoBeaming = ##${options.autoBeaming || "f"} 
	}
	
}

MergeHD = { \\mergeDifferentlyDottedOn \\mergeDifferentlyHeadedOn }


\\score {
	\\new GrandStaff <<${music}	>>

	\\layout {
	}${options.withMIDI ? "\n\t\\midi {" + (typeof options.withMIDI === "string" ? options.withMIDI : "") + "}" : ""}
}
`;


const renderSingle = music => renderDoc(music, { paper: { width: 200, height: 60 }, fontSize: 20 });
const renderMultiple = music => renderDoc(music, { paper: { width: 200, height: 283 }, fontSize: 20 });


const renderStaff = (name: string, content: string): string => `
		\\new Staff = "${name}" << \\MergeHD${content}		>>
`;


const isValidFraction = (frac: ParaffDocument.Fraction): boolean => frac.denominator > 0 && frac.numerator > 0 && Number.isInteger(frac.numerator) && Number.isInteger(frac.denominator);


const encodeKey = (key: number): string => Number.isInteger(key) ? `\\key ${KEYS[key]} ` : "";
const encodeTimeSig = (timeSig: ParaffDocument.Fraction): string => isValidFraction(timeSig) ? `\\time ${timeSig.numerator}/${timeSig.denominator} ` : "";

const encodeSpace = (time: ParaffDocument.Fraction): string => time.numerator === 1 ? `s${time.denominator}` : `s${time.denominator}*${time.numerator}`;


interface VoiceContext {
	staff?: number|null;
	key?: number|null;
	timeSig?: ParaffDocument.Fraction|null;
	partial?: boolean|null;
	octaveShift?: string;
	clef?: string|null;
	vi?: number;
};


interface EncoderOptions {
	autoBeam: boolean;
};


const encodeVoiceContent = (voice: ParaffDocument.Voice, ctx: VoiceContext, options: Partial<EncoderOptions> = {}): string => {
	let doc = "";

	if ((ctx.partial !== false) && voice.partial)
		doc += `\\partial ${voice.eventsTime.denominator}*${voice.eventsTime.numerator} `;

	if (!voice.terms) {
		if (voice.compensatedGraceTime)
			doc += `\\grace ${encodeSpace(voice.compensatedGraceTime)} `;
		doc += encodeSpace(voice.eventsTime);

		return doc;
	}

	let gracing = false;

	const crossedStaves = (voice.terms as ParaffDocument.ContextTerm[])
		.some(term => term.context && term.tick > 0 && (term.context as ParaffDocument.Staff).staff);

	const events = voice.terms.filter(term => (term as ParaffDocument.EventTerm).duration) as ParaffDocument.EventTerm[];
	const capitalRest = events.length === 1 && events[0].rest && !voice.partial;

	if (voice.compensatedGraceTime)
		doc += `\\grace ${encodeSpace(voice.compensatedGraceTime)} `;

	voice.terms.forEach(term => {
		const context = (term as ParaffDocument.ContextTerm).context;
		if (context) {
			const staff = (context as ParaffDocument.Staff).staff;
			const clef = (context as ParaffDocument.Clef).clef;
			const octaveShift = (context as ParaffDocument.OctaveShift).octaveShift;

			if (staff && staff !== ctx.staff) {
				doc += `\\change Staff = "${staff}" `;
				ctx.staff = staff;
			}
			else if (clef) {
				doc += `\\clef "${CLEFS[clef]}" `;
				ctx.clef = clef;
			}
			else if (octaveShift && octaveShift !== ctx.octaveShift) {
				doc += `\\ottava #${OATTVAS[octaveShift]} `;
				ctx.octaveShift = octaveShift;
			}

			if (staff) {
				if (voice.octaveShiftIn === "O0" && voice.octaveShiftIn !== ctx.octaveShift) {
					doc += `\\ottava #${OATTVAS[voice.octaveShiftIn]} `;
					ctx.octaveShift = voice.octaveShiftIn;
				}

				//if (ctx.clef)
				//	doc += `\\clef "${CLEFS[ctx.clef]}" `;

				// NOTE: voice term result in stem direction reset
				//if (ctx.vi && term.tick)
				//	doc += `\\voice${ENGLISH_NUMBERS[Math.min(3, ctx.vi)]} `;
			}
		}
		else {
			const event = term as ParaffDocument.EventTerm;

			if (!gracing && event.grace) {
				doc += "\\grace { ";
				gracing = true;
			}
			else if (gracing && !event.grace) {
				doc += "} ";
				gracing = false;
			}

			let tremoloDivision: number|null = null;
			if (event.tremoloPitcher) {
				tremoloDivision = event.tremoloPitcher;

				const repeat = 2 ** (event.tremoloPitcher - event.duration.division - 1) * (2 - 2 ** -(event.duration.dots || 0));
				doc += `\\repeat tremolo ${repeat} {`;
			}
			else if (event.tremoloCatcher)
				tremoloDivision = event.tremoloCatcher;
			else if (event.tremolo) {
				tremoloDivision = event.tremolo;

				const repeat = 2 ** (event.tremolo - event.duration.division) * (2 - 2 ** -(event.duration.dots || 0));
				doc += `\\repeat tremolo ${repeat}`;
			}

			if (event.timeWarp)
				doc += `\\times ${event.timeWarp.numerator}/${event.timeWarp.denominator} { `;

			if ((!(options && options.autoBeam) || crossedStaves || ctx.vi! > 2) && event.stem)
				doc += STEM_DIRECTIONS[event.stem] + " ";

			if (capitalRest)
				doc += "R";
			else if (event.space)
				doc += "s";
			else {
				if (event.chord.length > 1)
					doc += "<";
				event.chord.forEach((pitch, pi) => {
					if (pi)
						doc += " ";
					doc += pitch.phonet;
					doc += pitch.acc;
					if (pitch.octaves > 0)
						doc += "'".repeat(pitch.octaves);
					else if (pitch.octaves < 0)
						doc += ",".repeat(-pitch.octaves);
				});
				if (event.chord.length > 1)
					doc += ">";
			}

			if (!event.tremoloCatcher) {	// catcher event use the same division and dots as pitcher
				const literalDivsion = tremoloDivision || event.duration.division;
				doc += (2 ** literalDivsion).toString();
				if (event.duration.dots)
					doc += ".".repeat(event.duration.dots);
			}
			doc += " ";

			if (!capitalRest && !event.space && event.rest && event.chord.length < 2)
				doc += " \\rest ";

			if (event.beam && !event.illBeam)
				doc += `${BEAMS[event.beam]} `;

			if (event.marks) {
				event.marks.filter(mark => MARKS[mark]).forEach(mark => {
					doc += `${MARKS[mark]} `;
				});

				const dynamics = event.marks.filter(mark => DYNAMICS.includes(mark));
				if (dynamics.length) {
					const word = dynamics.map(mark => mark.slice(-1)).join("");
					if (DYNAMIC_WORDS.includes(word))
						doc += `\\${word} `;
				}
			}

			if (event.tremoloCatcher)
				doc += "} ";
			if (event.timeWarpEnd)
				doc += "} ";
		}
	});

	if (gracing)
		doc += "} ";

	return doc;
};


const encodeVoice = (voice: ParaffDocument.Voice, voiceIndex: number, measure: ParaffDocument.Measure, options: Partial<EncoderOptions> = {}): string => {
	const content = encodeVoiceContent(voice, { partial: measure.isPartial, staff: voice.staff }, options);

	const keyCmd = KEYS[measure.key] ? encodeKey(measure.key) : "";
	const timeSigCmd = measure.timeSig ? encodeTimeSig(measure.timeSig) : "";

	if (options.autoBeam && voiceIndex <= 3) {
		const vn = `\\voice${ENGLISH_NUMBERS[voiceIndex]}`;

		return `
		\\new Voice { ${vn} \\relative c' { ${keyCmd}${timeSigCmd}${content} } }
`;
	}

	return `
			\\new Voice \\relative c' { ${keyCmd}${timeSigCmd}${content} }
`;
};


const encodeMusic = (doc: ParaffDoc, options: Partial<EncoderOptions> = {}): string => {
	if ((doc as any).delimiter) {
		const delimiter = (doc as ParaffDocument.Special).delimiter;
		switch (delimiter) {
		case "BOS":
			return "\n% begin of score\n";
		case "EOS":
			return "\n% end of score\n";
		}

		return `\n% ${delimiter}\n`;
	}
	else if ((doc as any).descriptors && !(doc as any).voices)
		return `\n% ${(doc as any).descriptors.join(" ")}\n`;

	const measure = doc as ParaffDocument.Measure;
	const staffVoices = measure.voices.reduce((staves, voice) => {
		const si = voice.staff - 1;
		staves[si] = staves[si] || [];
		staves[si].push(voice);

		return staves;
	}, Array(measure.staffN).fill([]).map(() => []) as ParaffDocument.Voice[][]);

	const music = Array(measure.staffN).fill("")
		.map((_, si) => renderStaff((si + 1).toString(), staffVoices[si].map((voice, vi) => encodeVoice(voice, vi + 1, measure, options)).join("")))
		.join("");

	return music;
};


const encode = (doc: ParaffDoc, options: Partial<EncoderOptions> = {}): string => renderSingle(encodeMusic(doc, options));


const encodeMultiple = (docs: ParaffDoc[], markup: (string) => string = renderMultiple, options: Partial<EncoderOptions> = {}): string => {
	const measures = (docs as any[]).filter(doc => Number.isFinite(doc.staffN));
	const staffN = Math.max(...measures.map(doc => doc.staffN));

	// [si][mi][vi]
	const smVoices = Array(staffN).fill(null)
		.map((_, si) => measures.map(measure => {
			const vs = measure.voices.filter(voice => voice.staff === si + 1);
			if (vs[0]) {
				const v0 = vs[0];
				const e0 = (v0.terms as ParaffDocument.EventTerm[]).find(term => term.stem && !term.grace) as ParaffDocument.EventTerm;
				if (e0 && e0.stem === "Md") {
					vs[0] = vs[1];
					vs[1] = v0;
				}
			}

			return vs;
		}));

	const music = smVoices.map((mvs, si) => {
		const voiceN = Math.max(...mvs.map(vs => vs.length));

		const contents = Array(voiceN).fill(null).map((_, vi) => {
			const context = {
				staff: si + 1,
				key: null,
				timeSig: null,
				octaveShift: "O0",
				clef: null,
				vi: vi + 1,
			} as VoiceContext;

			return mvs.map((vs, mi) => {
				const measure = measures[mi];
				const v0 = measure.voices.find(Boolean)!;
				const v = vs[vi]
					|| {
						partial: v0.partial,
						eventsTime: v0.eventsTime,
						compensatedGraceTime: measure.defaultCompensatedGraceTime,
					} as ParaffDocument.Voice;

				let content = "";

				context.partial = measure.isPartial;

				if (measure.key !== context.key) {
					content += encodeKey(measure.key);
					context.key = measure.key;
				}

				if (measure.timeSig.numerator !== (context.timeSig && context.timeSig.numerator)
				|| measure.timeSig.denominator !== (context.timeSig && context.timeSig.denominator)) {
					content += encodeTimeSig(measure.timeSig);
					context.timeSig = measure.timeSig;
				}

				/*if (v.octaveShiftIn === "O0" && v.octaveShiftIn !== context.octaveShift) {
					content += `\\ottava #${OATTVAS[v.octaveShiftIn]} `;
					context.octaveShift = v.octaveShiftIn;
				}*/

				content += encodeVoiceContent(v, context, options);

				if (v.partial && !measure.isPartial) {
					const den = Math.max(v.eventsTime.denominator, measure.timeSig.denominator);
					const num = measure.timeSig.numerator * den / measure.timeSig.denominator - v.eventsTime.numerator * den / v.eventsTime.denominator;
					if (num)
						content += encodeSpace(frac(num, den));
				}

				return content;
			}).map(c => `\t\t\t\t\\relative c' { ${c} }`).map((line, li) => `${line} |	% ${li + 1}`).join("\n");
		});
		const content = contents.map((c, vi) => `\n\t\t\t\\new Voice { \\voice${ENGLISH_NUMBERS[Math.min(3, vi + 1)]}\n${c}\n\t\t\t}\n`).join("");

		return renderStaff((si + 1).toString(), content);
	}).join("\n");

	return markup(music);
};



export {
	encodeMusic,
	encode,
	encodeMultiple,
	renderDoc,
};

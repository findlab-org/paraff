
import { ParaffDocument, ParaffDoc } from "./paraff";
import * as grammar from "./grammar.jison.js";


// MEI key signatures: positive = sharps, negative = flats
const KEY_SIGS: Record<number, string> = {
	0: "0",
	1: "1s",
	2: "2s",
	3: "3s",
	4: "4s",
	5: "5s",
	6: "6s",
	[-1]: "1f",
	[-2]: "2f",
	[-3]: "3f",
	[-4]: "4f",
	[-5]: "5f",
	[-6]: "6f",
};


const CLEF_SHAPES: Record<string, { shape: string; line: number }> = {
	Cg: { shape: "G", line: 2 },  // treble
	Cf: { shape: "F", line: 4 },  // bass
	Cc: { shape: "C", line: 3 },  // alto
};


// Paraff duration division to MEI dur
// division 0 = whole, 1 = half, 2 = quarter, etc.
const DURATIONS: Record<number, string> = {
	[-2]: "breve",
	[-1]: "1",  // double whole shown as whole in MEI
	0: "1",     // whole
	1: "2",     // half
	2: "4",     // quarter
	3: "8",     // eighth
	4: "16",
	5: "32",
	6: "64",
	7: "128",
};


// Pitch name mapping (Paraff uses lowercase)
const PITCH_NAMES: Record<string, string> = {
	c: "c",
	d: "d",
	e: "e",
	f: "f",
	g: "g",
	a: "a",
	b: "b",
};


// Accidental mapping
const ACCIDENTALS: Record<string, string> = {
	s: "s",    // sharp
	f: "f",    // flat
	n: "n",    // natural
	ss: "ss",  // double sharp (x in some notations)
	ff: "ff",  // double flat
};


// Dynamic character to word mapping
const DYNAMIC_WORDS_MAP: Record<string, string> = {
	'f': 'f',
	'p': 'p',
	'm': 'm',
	'r': 'r',
	's': 's',
	'z': 'z'
};


// Expressive mark to note property mapping
const MARK_PROPERTIES: Record<string, string> = {
	'slurL': 'slurStart',
	'slurR': 'slurEnd',
	'tie': 'tie',
	'fer': 'fermata',
	'tr': 'trill',
	'st': 'staccato',
	'ac': 'accent',
	'ten': 'tenuto',
	'mar': 'marcato',
	'arp': 'arpeggio',
	'turn': 'turn',
	'mor': 'mordent',
	'sf': 'sforzando',
	'stm': 'staccatissimo',
	'por': 'portato'
};


let idCounter = 0;

const generateId = (prefix: string): string => {
	return `${prefix}-${String(++idCounter).padStart(10, "0")}`;
};

const resetIdCounter = (): void => {
	idCounter = 0;
};


interface MEIEncoderOptions {
	indent?: string;
	xmlDeclaration?: boolean;
}


// Internal types for parsed note representation
interface ParsedPitch {
	pname: string;
	oct: number;
	accid?: string;
}


interface ParsedNote {
	pitches: ParsedPitch[];
	dur: string;
	rest?: boolean;
	dots?: number;
	grace?: boolean;
	tie?: 'i' | 'm' | 't';
	beam?: 'i' | 'm' | 't';
	stemDir?: 'up' | 'down';
	slurStart?: boolean;
	slurEnd?: boolean;
	fermata?: boolean;
	trill?: boolean;
	staccato?: boolean;
	accent?: boolean;
	tenuto?: boolean;
	marcato?: boolean;
	arpeggio?: boolean;
	turn?: boolean;
	mordent?: boolean;
	sforzando?: boolean;
	staccatissimo?: boolean;
	portato?: boolean;
	staff?: number;
	clefBefore?: string;
}


interface ParsedMeasure {
	key: number;
	timeNum: number;
	timeDen: number;
	clef: string;
	staffN: number;
	notes: ParsedNote[][];
	dynamics?: { type: string; voiceIdx: number; noteIdx: number }[];
	staffClefs: Record<number, string>;
	voiceStaff: number[];
}


interface ParsedScore {
	measures: ParsedMeasure[];
}


// Convert ParaffDocument.Pitch to internal format
const encodePitch = (pitch: ParaffDocument.Pitch): ParsedPitch => {
	const pname = PITCH_NAMES[pitch.phonet.toLowerCase()] || pitch.phonet.toLowerCase();
	// The note field represents absolute pitch position relative to middle C (c4=0)
	// It already incorporates octave shifts (Osup/Osub) into the position.
	// Formula: octave = 4 + floor(note/7)
	const oct = 4 + Math.floor(pitch.note / 7);
	const accid = pitch.acc ? ACCIDENTALS[pitch.acc] : undefined;

	return { pname, oct, accid };
};


// Convert ParaffDocument.EventTerm to ParsedNote
const convertEventTerm = (term: ParaffDocument.EventTerm): ParsedNote => {
	const pitches = term.chord.map(encodePitch);
	const dur = DURATIONS[term.duration?.division ?? 2] || "4";
	const dots = term.duration?.dots || 0;

	const note: ParsedNote = {
		pitches: pitches.length > 0 ? pitches : [{ pname: 'c', oct: 4 }],
		dur,
		rest: term.rest || term.space,
		dots: dots > 0 ? dots : undefined,
		grace: term.grace,
		staff: term.staff
	};

	// Convert stem direction
	if (term.stemDirection === 'Mu') note.stemDir = 'up';
	else if (term.stemDirection === 'Md') note.stemDir = 'down';

	// Convert beam
	if (term.beam === 'Bl') note.beam = 'i';
	else if (term.beam === 'Bm') note.beam = 'm';
	else if (term.beam === 'Br') note.beam = 't';

	// Convert expressive marks
	if (term.marks) {
		for (const mark of term.marks) {
			const prop = MARK_PROPERTIES[mark];
			if (prop) {
				if (prop === 'tie') {
					note.tie = 'i';
				} else if (prop === 'slurStart') {
					note.slurStart = true;
				} else if (prop === 'slurEnd') {
					note.slurEnd = true;
				} else {
					(note as any)[prop] = true;
				}
			}
		}
	}

	return note;
};


// Helper to build a single note element
const buildNoteElement = (pitch: ParsedPitch, dur: string, note: ParsedNote, indent: string, inChord: boolean, layerStaff?: number): string => {
	let attrs = `xml:id="${generateId('note')}" pname="${pitch.pname}" oct="${pitch.oct}"`;
	if (!inChord) {
		attrs += ` dur="${dur}"`;
	}
	if (pitch.accid) attrs += ` accid="${pitch.accid}"`;
	if (!inChord && note.dots) attrs += ` dots="${note.dots}"`;
	if (!inChord && note.grace) attrs += ` grace="unacc"`;
	if (!inChord && note.tie) attrs += ` tie="${note.tie}"`;
	if (!inChord && note.stemDir) attrs += ` stem.dir="${note.stemDir}"`;
	if (!inChord && layerStaff && note.staff && note.staff !== layerStaff) {
		attrs += ` staff="${note.staff}"`;
	}
	if (!inChord) {
		const slurParts: string[] = [];
		if (note.slurStart) slurParts.push('i');
		if (note.slurEnd) slurParts.push('t');
		if (slurParts.length > 0) attrs += ` slur="${slurParts.join(' ')}"`;
	}

	const hasChildren = !inChord && (note.fermata || note.trill || note.staccato || note.accent || note.tenuto || note.marcato || note.arpeggio || note.turn || note.mordent || note.sforzando || note.staccatissimo || note.portato);

	if (!hasChildren) {
		return `${indent}<note ${attrs} />\n`;
	}

	let result = `${indent}<note ${attrs}>\n`;

	const artics: string[] = [];
	if (note.staccato) artics.push('stacc');
	if (note.accent) artics.push('acc');
	if (note.tenuto) artics.push('ten');
	if (note.marcato) artics.push('marc');
	if (note.staccatissimo) artics.push('staccatissimo');
	if (note.portato) artics.push('ten-stacc');

	if (artics.length > 0) {
		result += `${indent}    <artic artic="${artics.join(' ')}" />\n`;
	}

	if (note.fermata) {
		result += `${indent}    <fermata xml:id="${generateId('fermata')}" />\n`;
	}

	if (note.trill) {
		result += `${indent}    <trill xml:id="${generateId('trill')}" />\n`;
	}

	if (note.arpeggio) {
		result += `${indent}    <arpeg xml:id="${generateId('arpeg')}" />\n`;
	}

	if (note.turn) {
		result += `${indent}    <turn xml:id="${generateId('turn')}" />\n`;
	}

	if (note.mordent) {
		result += `${indent}    <mordent xml:id="${generateId('mordent')}" />\n`;
	}

	if (note.sforzando) {
		result += `${indent}    <dynam xml:id="${generateId('dynam')}">sf</dynam>\n`;
	}

	result += `${indent}</note>\n`;

	return result;
};


// Convert ParsedNote to MEI XML
const noteToMEI = (note: ParsedNote, indent: string, layerStaff?: number): string => {
	let clefOutput = '';

	if (note.clefBefore) {
		const clefInfo = CLEF_SHAPES[note.clefBefore];
		if (clefInfo) {
			clefOutput = `${indent}<clef xml:id="${generateId('clef')}" shape="${clefInfo.shape}" line="${clefInfo.line}" />\n`;
		}
	}

	if (note.rest) {
		let attrs = `xml:id="${generateId('rest')}" dur="${note.dur}"`;
		if (note.dots) attrs += ` dots="${note.dots}"`;
		if (layerStaff && note.staff && note.staff !== layerStaff) {
			attrs += ` staff="${note.staff}"`;
		}
		return clefOutput + `${indent}<rest ${attrs} />\n`;
	}

	if (note.pitches.length === 1) {
		return clefOutput + buildNoteElement(note.pitches[0], note.dur, note, indent, false, layerStaff);
	}

	// Chord
	let chordAttrs = `xml:id="${generateId('chord')}" dur="${note.dur}"`;
	if (note.dots) chordAttrs += ` dots="${note.dots}"`;
	if (note.grace) chordAttrs += ` grace="unacc"`;
	if (note.tie) chordAttrs += ` tie="${note.tie}"`;
	if (note.stemDir) chordAttrs += ` stem.dir="${note.stemDir}"`;
	if (layerStaff && note.staff && note.staff !== layerStaff) {
		chordAttrs += ` staff="${note.staff}"`;
	}
	const chordSlurParts: string[] = [];
	if (note.slurStart) chordSlurParts.push('i');
	if (note.slurEnd) chordSlurParts.push('t');
	if (chordSlurParts.length > 0) chordAttrs += ` slur="${chordSlurParts.join(' ')}"`;

	let result = `${indent}<chord ${chordAttrs}>\n`;

	for (const pitch of note.pitches) {
		result += buildNoteElement(pitch, note.dur, note, indent + '    ', true, layerStaff);
	}

	const artics: string[] = [];
	if (note.staccato) artics.push('stacc');
	if (note.accent) artics.push('acc');
	if (note.tenuto) artics.push('ten');
	if (note.marcato) artics.push('marc');
	if (note.staccatissimo) artics.push('staccatissimo');
	if (note.portato) artics.push('ten-stacc');

	if (artics.length > 0) {
		result += `${indent}    <artic artic="${artics.join(' ')}" />\n`;
	}

	if (note.fermata) {
		result += `${indent}    <fermata xml:id="${generateId('fermata')}" />\n`;
	}

	if (note.trill) {
		result += `${indent}    <trill xml:id="${generateId('trill')}" />\n`;
	}

	if (note.arpeggio) {
		result += `${indent}    <arpeg xml:id="${generateId('arpeg')}" />\n`;
	}

	if (note.turn) {
		result += `${indent}    <turn xml:id="${generateId('turn')}" />\n`;
	}

	if (note.mordent) {
		result += `${indent}    <mordent xml:id="${generateId('mordent')}" />\n`;
	}

	if (note.sforzando) {
		result += `${indent}    <dynam xml:id="${generateId('dynam')}">sf</dynam>\n`;
	}

	result += `${indent}</chord>\n`;

	return clefOutput + result;
};


// Convert ParaffDocument.Measure to ParsedMeasure
const convertMeasure = (measure: ParaffDocument.Measure): ParsedMeasure => {
	const result: ParsedMeasure = {
		key: measure.key,
		timeNum: measure.timeSig?.numerator || 4,
		timeDen: measure.timeSig?.denominator || 4,
		clef: 'Cg',
		staffN: measure.staffN || 1,
		notes: [],
		dynamics: [],
		staffClefs: {},
		voiceStaff: []
	};

	// Process each voice
	for (let vi = 0; vi < measure.voices.length; vi++) {
		const voice = measure.voices[vi];
		const voiceNotes: ParsedNote[] = [];

		// Track voice's staff
		result.voiceStaff[vi] = voice.staff || 1;

		// Get clef from voice
		if (voice.headClef) {
			result.staffClefs[voice.staff || 1] = voice.headClef;
			if (voice.staff === 1 || result.clef === 'Cg') {
				result.clef = voice.headClef;
			}
		}

		// Process terms
		for (const term of voice.terms) {
			// Check if it's an event term (has duration)
			const eventTerm = term as ParaffDocument.EventTerm;
			if (eventTerm.duration !== undefined) {
				voiceNotes.push(convertEventTerm(eventTerm));
			}

			// Check if it's a context term
			const contextTerm = term as ParaffDocument.ContextTerm;
			if (contextTerm.context) {
				const ctx = contextTerm.context as any;
				// Handle dynamic marks from context
				if (ctx.dynamic) {
					result.dynamics!.push({
						type: ctx.dynamic,
						voiceIdx: vi,
						noteIdx: voiceNotes.length
					});
				}
			}
		}

		result.notes[vi] = voiceNotes;
	}

	// Set default clef for staff 1 if not set
	if (!result.staffClefs[1]) {
		result.staffClefs[1] = 'Cg';
	}

	return result;
};


// Encode a layer (voice) within a staff
const encodeLayer = (
	notes: ParsedNote[],
	layerN: number,
	indent: string,
	layerStaff: number,
	dynamics?: { type: string; voiceIdx: number; noteIdx: number }[]
): string => {
	const layerId = generateId("layer");
	let xml = `${indent}<layer xml:id="${layerId}" n="${layerN}">\n`;

	notes.forEach((note, noteIdx) => {
		// Add dynamics at this position
		if (dynamics) {
			const dynamicsHere = dynamics.filter(d => d.noteIdx === noteIdx);
			for (const dyn of dynamicsHere) {
				const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
				xml += `${indent}    <dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
			}
		}
		xml += noteToMEI(note, indent + "    ", layerStaff);
	});

	// Add dynamics at end
	if (dynamics) {
		const dynamicsAtEnd = dynamics.filter(d => d.noteIdx >= notes.length);
		for (const dyn of dynamicsAtEnd) {
			const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
			xml += `${indent}    <dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
		}
	}

	xml += `${indent}</layer>\n`;
	return xml;
};


// Encode a staff with multiple voices
const encodeStaffFromParsed = (
	voices: { voiceIdx: number; notes: ParsedNote[] }[],
	staffN: number,
	indent: string,
	dynamics?: { type: string; voiceIdx: number; noteIdx: number }[]
): string => {
	const staffId = generateId("staff");
	let xml = `${indent}<staff xml:id="${staffId}" n="${staffN}">\n`;

	if (voices.length === 0) {
		xml += `${indent}    <layer xml:id="${generateId('layer')}" n="1" />\n`;
	} else {
		voices.forEach((v, layerIdx) => {
			const voiceDynamics = dynamics?.filter(d => d.voiceIdx === v.voiceIdx) || [];
			xml += encodeLayer(v.notes, layerIdx + 1, indent + "    ", staffN, voiceDynamics);
		});
	}

	xml += `${indent}</staff>\n`;
	return xml;
};


// Original API: encode voice from ParaffDocument
const encodeVoice = (voice: ParaffDocument.Voice, layerN: number, indent: string): string => {
	const layerId = generateId("layer");
	let xml = `${indent}<layer xml:id="${layerId}" n="${layerN}">\n`;

	if (voice.terms) {
		for (const term of voice.terms) {
			const eventTerm = term as ParaffDocument.EventTerm;
			if (eventTerm.duration) {
				const parsedNote = convertEventTerm(eventTerm);
				xml += noteToMEI(parsedNote, indent + "    ");
			}
		}
	}

	xml += `${indent}</layer>\n`;
	return xml;
};


// Original API: encode staff from ParaffDocument voices
const encodeStaff = (voices: ParaffDocument.Voice[], staffN: number, indent: string): string => {
	const staffId = generateId("staff");
	let xml = `${indent}<staff xml:id="${staffId}" n="${staffN}">\n`;

	voices.forEach((voice, vi) => {
		xml += encodeVoice(voice, vi + 1, indent + "    ");
	});

	xml += `${indent}</staff>\n`;
	return xml;
};


// Encode measure content from ParsedMeasure
const encodeMeasureFromParsed = (measure: ParsedMeasure, measureN: number, indent: string): string => {
	const measureId = generateId("measure");
	let xml = `${indent}<measure xml:id="${measureId}" n="${measureN}">\n`;

	// Group voices by staff
	const voicesByStaff: Record<number, { voiceIdx: number; notes: ParsedNote[] }[]> = {};

	measure.notes.forEach((voice, vi) => {
		const staffNum = measure.voiceStaff[vi] || 1;
		if (!voicesByStaff[staffNum]) {
			voicesByStaff[staffNum] = [];
		}
		voicesByStaff[staffNum].push({ voiceIdx: vi, notes: voice });
	});

	// Encode each staff
	for (let si = 1; si <= measure.staffN; si++) {
		const voices = voicesByStaff[si] || [];
		xml += encodeStaffFromParsed(voices, si, indent + "    ", measure.dynamics);
	}

	xml += `${indent}</measure>\n`;
	return xml;
};


// Original API: encode measure from ParaffDocument
const encodeMeasure = (measure: ParaffDocument.Measure, measureN: number, indent: string): string => {
	const measureId = generateId("measure");
	let xml = `${indent}<measure xml:id="${measureId}" n="${measureN}">\n`;

	// Group voices by staff
	const staffVoices: ParaffDocument.Voice[][] = Array(measure.staffN).fill(null).map(() => []);
	for (const voice of measure.voices) {
		const si = voice.staff - 1;
		if (si >= 0 && si < measure.staffN) {
			staffVoices[si].push(voice);
		}
	}

	// Encode each staff
	for (let si = 0; si < measure.staffN; si++) {
		if (staffVoices[si].length > 0) {
			xml += encodeStaff(staffVoices[si], si + 1, indent + "    ");
		}
	}

	xml += `${indent}</measure>\n`;
	return xml;
};


const encodeScoreDef = (measure: ParaffDocument.Measure, indent: string): string => {
	const scoreDefId = generateId("scoredef");
	const keySig = KEY_SIGS[measure.key] || "0";
	const meterCount = measure.timeSig?.numerator || 4;
	const meterUnit = measure.timeSig?.denominator || 4;

	let xml = `${indent}<scoreDef xml:id="${scoreDefId}" key.sig="${keySig}" meter.count="${meterCount}" meter.unit="${meterUnit}">\n`;
	xml += `${indent}    <staffGrp xml:id="${generateId("staffgrp")}">\n`;

	// Create staff definitions
	for (let si = 0; si < measure.staffN; si++) {
		const staffDefId = generateId("staffdef");
		// Find clef from first voice of this staff
		const voice = measure.voices.find(v => v.staff === si + 1);
		const clefInfo = voice?.headClef ? CLEF_SHAPES[voice.headClef] : CLEF_SHAPES["Cg"];
		const { shape, line } = clefInfo || { shape: "G", line: 2 };

		xml += `${indent}        <staffDef xml:id="${staffDefId}" n="${si + 1}" lines="5" clef.shape="${shape}" clef.line="${line}" />\n`;
	}

	xml += `${indent}    </staffGrp>\n`;
	xml += `${indent}</scoreDef>\n`;
	return xml;
};


const encodeScoreDefFromParsed = (measure: ParsedMeasure, indent: string): string => {
	const scoreDefId = generateId("scoredef");
	const keySig = KEY_SIGS[measure.key] || "0";

	let xml = `${indent}<scoreDef xml:id="${scoreDefId}" key.sig="${keySig}" meter.count="${measure.timeNum}" meter.unit="${measure.timeDen}">\n`;
	xml += `${indent}    <staffGrp xml:id="${generateId("staffgrp")}">\n`;

	for (let s = 1; s <= measure.staffN; s++) {
		const clef = measure.staffClefs[s] || 'Cg';
		const clefInfo = CLEF_SHAPES[clef] || CLEF_SHAPES['Cg'];
		xml += `${indent}        <staffDef xml:id="${generateId('staffdef')}" n="${s}" lines="5" clef.shape="${clefInfo.shape}" clef.line="${clefInfo.line}" />\n`;
	}

	xml += `${indent}    </staffGrp>\n`;
	xml += `${indent}</scoreDef>\n`;
	return xml;
};


// Original API: encodeMusic - encode just the measure part
const encodeMusic = (doc: ParaffDoc, measureN: number = 1): string => {
	if ((doc as any).delimiter) {
		return `<!-- ${(doc as ParaffDocument.Special).delimiter} -->\n`;
	}

	const measure = doc as ParaffDocument.Measure;
	return encodeMeasure(measure, measureN, "                        ");
};


// Original API: encode single measure to complete MEI
const encode = (doc: ParaffDoc, options: MEIEncoderOptions = {}): string => {
	const indent = options.indent || "    ";
	resetIdCounter();

	if ((doc as any).delimiter) {
		return `<!-- ${(doc as ParaffDocument.Special).delimiter} -->`;
	}

	const measure = doc as ParaffDocument.Measure;
	const xmlDecl = options.xmlDeclaration !== false
		? '<?xml version="1.0" encoding="UTF-8"?>\n'
		: "";

	let mei = xmlDecl;
	mei += '<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">\n';
	mei += `${indent}<meiHead>\n`;
	mei += `${indent}${indent}<fileDesc>\n`;
	mei += `${indent}${indent}${indent}<titleStmt>\n`;
	mei += `${indent}${indent}${indent}${indent}<title>Paraff Export</title>\n`;
	mei += `${indent}${indent}${indent}</titleStmt>\n`;
	mei += `${indent}${indent}${indent}<pubStmt />\n`;
	mei += `${indent}${indent}</fileDesc>\n`;
	mei += `${indent}${indent}<encodingDesc>\n`;
	mei += `${indent}${indent}${indent}<projectDesc>\n`;
	mei += `${indent}${indent}${indent}${indent}<p>Encoded with Paraff MEIEncoder</p>\n`;
	mei += `${indent}${indent}${indent}</projectDesc>\n`;
	mei += `${indent}${indent}</encodingDesc>\n`;
	mei += `${indent}</meiHead>\n`;
	mei += `${indent}<music>\n`;
	mei += `${indent}${indent}<body>\n`;
	mei += `${indent}${indent}${indent}<mdiv xml:id="${generateId("mdiv")}">\n`;
	mei += `${indent}${indent}${indent}${indent}<score xml:id="${generateId("score")}">\n`;
	mei += encodeScoreDef(measure, `${indent}${indent}${indent}${indent}${indent}`);
	mei += `${indent}${indent}${indent}${indent}${indent}<section xml:id="${generateId("section")}">\n`;
	mei += encodeMeasure(measure, 1, `${indent}${indent}${indent}${indent}${indent}${indent}`);
	mei += `${indent}${indent}${indent}${indent}${indent}</section>\n`;
	mei += `${indent}${indent}${indent}${indent}</score>\n`;
	mei += `${indent}${indent}${indent}</mdiv>\n`;
	mei += `${indent}${indent}</body>\n`;
	mei += `${indent}</music>\n`;
	mei += '</mei>\n';

	return mei;
};


// Original API: encodeMultiple - encode multiple measures to complete MEI
const encodeMultiple = (docs: ParaffDoc[], options: MEIEncoderOptions = {}): string => {
	const indent = options.indent || "    ";
	resetIdCounter();

	const measures = docs.filter(doc => (doc as any).staffN !== undefined) as ParaffDocument.Measure[];
	if (measures.length === 0) {
		return "";
	}

	const firstMeasure = measures[0];
	const xmlDecl = options.xmlDeclaration !== false
		? '<?xml version="1.0" encoding="UTF-8"?>\n'
		: "";

	let mei = xmlDecl;
	mei += '<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">\n';
	mei += `${indent}<meiHead>\n`;
	mei += `${indent}${indent}<fileDesc>\n`;
	mei += `${indent}${indent}${indent}<titleStmt>\n`;
	mei += `${indent}${indent}${indent}${indent}<title>Paraff Export</title>\n`;
	mei += `${indent}${indent}${indent}</titleStmt>\n`;
	mei += `${indent}${indent}${indent}<pubStmt />\n`;
	mei += `${indent}${indent}</fileDesc>\n`;
	mei += `${indent}${indent}<encodingDesc>\n`;
	mei += `${indent}${indent}${indent}<projectDesc>\n`;
	mei += `${indent}${indent}${indent}${indent}<p>Encoded with Paraff MEIEncoder</p>\n`;
	mei += `${indent}${indent}${indent}</projectDesc>\n`;
	mei += `${indent}${indent}</encodingDesc>\n`;
	mei += `${indent}</meiHead>\n`;
	mei += `${indent}<music>\n`;
	mei += `${indent}${indent}<body>\n`;
	mei += `${indent}${indent}${indent}<mdiv xml:id="${generateId("mdiv")}">\n`;
	mei += `${indent}${indent}${indent}${indent}<score xml:id="${generateId("score")}">\n`;
	mei += encodeScoreDef(firstMeasure, `${indent}${indent}${indent}${indent}${indent}`);
	mei += `${indent}${indent}${indent}${indent}${indent}<section xml:id="${generateId("section")}">\n`;

	measures.forEach((measure, mi) => {
		mei += encodeMeasure(measure, mi + 1, `${indent}${indent}${indent}${indent}${indent}${indent}`);
	});

	mei += `${indent}${indent}${indent}${indent}${indent}</section>\n`;
	mei += `${indent}${indent}${indent}${indent}</score>\n`;
	mei += `${indent}${indent}${indent}</mdiv>\n`;
	mei += `${indent}${indent}</body>\n`;
	mei += `${indent}</music>\n`;
	mei += '</mei>\n';

	return mei;
};


// ===== Browser API: Parsing and conversion functions =====

// Parse paraff code using jison grammar
const parseWithGrammar = (code: string): ParaffDoc | null => {
	try {
		return grammar.parse(code);
	} catch (e) {
		console.error('Parse error:', e);
		return null;
	}
};


// Parse a single measure from paraff code
const parseParaff = (code: string): ParsedMeasure | null => {
	const doc = parseWithGrammar(code);
	if (!doc) return null;

	// Check if it's a special delimiter
	if ((doc as ParaffDocument.Special).delimiter) {
		return null;
	}

	const measure = doc as ParaffDocument.Measure;
	return convertMeasure(measure);
};


// Parse multiple measures from paraff code
const parseParaffScore = (code: string): ParsedScore | null => {
	// Split code into measures and parse each
	const tokens = code.trim().split(/\s+/);

	let startIdx = 0;
	let endIdx = tokens.length;

	if (tokens[0] === 'BOS') startIdx = 1;
	if (tokens[tokens.length - 1] === 'EOS') endIdx = tokens.length - 1;

	// Find measure boundaries
	const measureCodes: string[] = [];
	let currentTokens: string[] = [];
	let inMeasure = false;

	for (let i = startIdx; i < endIdx; i++) {
		const token = tokens[i];
		if (token === 'BOM') {
			inMeasure = true;
			currentTokens = ['BOM'];
		} else if (token === 'EOM') {
			if (inMeasure) {
				currentTokens.push('EOM');
				measureCodes.push(currentTokens.join(' '));
				inMeasure = false;
			}
		} else if (inMeasure) {
			currentTokens.push(token);
		}
	}

	if (measureCodes.length === 0) {
		return null;
	}

	// Parse each measure
	const measures: ParsedMeasure[] = [];
	let currentKey = 0;
	let currentTimeNum = 4;
	let currentTimeDen = 4;
	let currentClefsByStaff: Record<number, string> = { 1: 'Cg' };

	for (const measureCode of measureCodes) {
		const parsed = parseParaff(measureCode);
		if (parsed) {
			// Carry forward context from previous measure if not specified
			if (parsed.key === 0 && currentKey !== 0) parsed.key = currentKey;
			if (parsed.timeNum === 4 && parsed.timeDen === 4) {
				if (currentTimeNum !== 4 || currentTimeDen !== 4) {
					parsed.timeNum = currentTimeNum;
					parsed.timeDen = currentTimeDen;
				}
			}

			// Merge clefs
			for (const [staff, clef] of Object.entries(currentClefsByStaff)) {
				if (!parsed.staffClefs[parseInt(staff)]) {
					parsed.staffClefs[parseInt(staff)] = clef;
				}
			}

			measures.push(parsed);

			// Update context for next measure
			currentKey = parsed.key;
			currentTimeNum = parsed.timeNum;
			currentTimeDen = parsed.timeDen;
			currentClefsByStaff = { ...currentClefsByStaff, ...parsed.staffClefs };
		}
	}

	return measures.length > 0 ? { measures } : null;
};


// Convert ParsedMeasure to MEI
const toMEI = (measure: ParsedMeasure): string => {
	resetIdCounter();

	const indent = "    ";
	let mei = '<?xml version="1.0" encoding="UTF-8"?>\n';
	mei += '<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">\n';
	mei += `${indent}<meiHead>\n`;
	mei += `${indent}${indent}<fileDesc>\n`;
	mei += `${indent}${indent}${indent}<titleStmt>\n`;
	mei += `${indent}${indent}${indent}${indent}<title>Paraff Live Editor</title>\n`;
	mei += `${indent}${indent}${indent}</titleStmt>\n`;
	mei += `${indent}${indent}${indent}<pubStmt />\n`;
	mei += `${indent}${indent}</fileDesc>\n`;
	mei += `${indent}</meiHead>\n`;
	mei += `${indent}<music>\n`;
	mei += `${indent}${indent}<body>\n`;
	mei += `${indent}${indent}${indent}<mdiv xml:id="${generateId("mdiv")}">\n`;
	mei += `${indent}${indent}${indent}${indent}<score xml:id="${generateId("score")}">\n`;
	mei += encodeScoreDefFromParsed(measure, `${indent}${indent}${indent}${indent}${indent}`);
	mei += `${indent}${indent}${indent}${indent}${indent}<section xml:id="${generateId("section")}">\n`;
	mei += encodeMeasureFromParsed(measure, 1, `${indent}${indent}${indent}${indent}${indent}${indent}`);
	mei += `${indent}${indent}${indent}${indent}${indent}</section>\n`;
	mei += `${indent}${indent}${indent}${indent}</score>\n`;
	mei += `${indent}${indent}${indent}</mdiv>\n`;
	mei += `${indent}${indent}</body>\n`;
	mei += `${indent}</music>\n`;
	mei += '</mei>';

	return mei;
};


// Convert ParsedScore to MEI
const scoreToMEI = (score: ParsedScore): string => {
	resetIdCounter();

	if (score.measures.length === 0) return '';

	const firstMeasure = score.measures[0];

	let maxStaffN = 1;
	const staffClefs: Record<number, string> = {};

	for (const measure of score.measures) {
		maxStaffN = Math.max(maxStaffN, measure.staffN);
		for (const [staffNum, clef] of Object.entries(measure.staffClefs)) {
			const sn = parseInt(staffNum);
			if (!staffClefs[sn]) {
				staffClefs[sn] = clef;
			}
		}
	}

	const indent = "    ";
	let mei = '<?xml version="1.0" encoding="UTF-8"?>\n';
	mei += '<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">\n';
	mei += `${indent}<meiHead>\n`;
	mei += `${indent}${indent}<fileDesc>\n`;
	mei += `${indent}${indent}${indent}<titleStmt>\n`;
	mei += `${indent}${indent}${indent}${indent}<title>Paraff Live Editor</title>\n`;
	mei += `${indent}${indent}${indent}</titleStmt>\n`;
	mei += `${indent}${indent}${indent}<pubStmt />\n`;
	mei += `${indent}${indent}</fileDesc>\n`;
	mei += `${indent}</meiHead>\n`;
	mei += `${indent}<music>\n`;
	mei += `${indent}${indent}<body>\n`;
	mei += `${indent}${indent}${indent}<mdiv xml:id="${generateId("mdiv")}">\n`;
	mei += `${indent}${indent}${indent}${indent}<score xml:id="${generateId("score")}">\n`;

	// Custom scoreDef for score
	const keySig = KEY_SIGS[firstMeasure.key] || "0";
	mei += `${indent}${indent}${indent}${indent}${indent}<scoreDef xml:id="${generateId("scoredef")}" key.sig="${keySig}" meter.count="${firstMeasure.timeNum}" meter.unit="${firstMeasure.timeDen}">\n`;
	mei += `${indent}${indent}${indent}${indent}${indent}${indent}<staffGrp xml:id="${generateId("staffgrp")}">\n`;
	for (let s = 1; s <= maxStaffN; s++) {
		const clef = staffClefs[s] || 'Cg';
		const clefInfo = CLEF_SHAPES[clef] || CLEF_SHAPES['Cg'];
		mei += `${indent}${indent}${indent}${indent}${indent}${indent}${indent}<staffDef xml:id="${generateId('staffdef')}" n="${s}" lines="5" clef.shape="${clefInfo.shape}" clef.line="${clefInfo.line}" />\n`;
	}
	mei += `${indent}${indent}${indent}${indent}${indent}${indent}</staffGrp>\n`;
	mei += `${indent}${indent}${indent}${indent}${indent}</scoreDef>\n`;

	mei += `${indent}${indent}${indent}${indent}${indent}<section xml:id="${generateId("section")}">\n`;

	score.measures.forEach((measure, mi) => {
		// Override staffN to use maxStaffN
		const adjustedMeasure = { ...measure, staffN: maxStaffN };
		mei += encodeMeasureFromParsed(adjustedMeasure, mi + 1, `${indent}${indent}${indent}${indent}${indent}${indent}`);
	});

	mei += `${indent}${indent}${indent}${indent}${indent}</section>\n`;
	mei += `${indent}${indent}${indent}${indent}</score>\n`;
	mei += `${indent}${indent}${indent}</mdiv>\n`;
	mei += `${indent}${indent}</body>\n`;
	mei += `${indent}</music>\n`;
	mei += '</mei>';

	return mei;
};


// Convert paraff code string to MEI
const paraffToMEI = (code: string): string | null => {
	const score = parseParaffScore(code);
	if (score && score.measures.length > 1) {
		return scoreToMEI(score);
	}

	const parsed = parseParaff(code);
	if (!parsed) return null;
	return toMEI(parsed);
};


// Export original API
export {
	encode,
	encodeMultiple,
	encodeMusic,
	resetIdCounter,
	MEIEncoderOptions,
};

// Export browser API
export {
	parseParaff,
	parseParaffScore,
	paraffToMEI,
	toMEI,
	scoreToMEI,
};

// Export types for external use
export type { ParsedNote, ParsedMeasure, ParsedScore };

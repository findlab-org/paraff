
import { ParaffDocument, ParaffDoc } from "./paraff";
import { ExpressiveMark } from "./types";


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


const escapeXml = (str: string): string => {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
};


const encodePitch = (pitch: ParaffDocument.Pitch): { pname: string; oct: number; accid?: string } => {
	const pname = PITCH_NAMES[pitch.phonet.toLowerCase()] || pitch.phonet.toLowerCase();
	// The note field represents absolute pitch position relative to middle C (c4=0)
	// It already incorporates octave shifts (Osup/Osub) into the position.
	// Formula: octave = 4 + floor(note/7)
	// e.g., d5 (from "d Osup") has note=8, so oct = 4 + floor(8/7) = 4 + 1 = 5
	// e.g., g3 has note=-3, so oct = 4 + floor(-3/7) = 4 + (-1) = 3
	const oct = 4 + Math.floor(pitch.note / 7);
	const accid = pitch.acc ? ACCIDENTALS[pitch.acc] : undefined;

	return { pname, oct, accid };
};


const encodeNote = (
	pitch: ParaffDocument.Pitch,
	duration: ParaffDocument.Duration,
	isRest: boolean,
	indent: string
): string => {
	const id = generateId(isRest ? "rest" : "note");
	const dur = DURATIONS[duration.division] || "4";
	const dots = duration.dots || 0;

	if (isRest) {
		let attrs = `xml:id="${id}" dur="${dur}"`;
		if (dots > 0) attrs += ` dots="${dots}"`;
		return `${indent}<rest ${attrs} />\n`;
	}

	const { pname, oct, accid } = encodePitch(pitch);
	let attrs = `xml:id="${id}" dur="${dur}" oct="${oct}" pname="${pname}"`;
	if (dots > 0) attrs += ` dots="${dots}"`;
	if (accid) attrs += ` accid="${accid}"`;

	return `${indent}<note ${attrs} />\n`;
};


const encodeChord = (
	chord: ParaffDocument.Pitch[],
	duration: ParaffDocument.Duration,
	indent: string
): string => {
	if (chord.length === 1) {
		return encodeNote(chord[0], duration, false, indent);
	}

	const id = generateId("chord");
	const dur = DURATIONS[duration.division] || "4";
	const dots = duration.dots || 0;

	let dotsAttr = dots > 0 ? ` dots="${dots}"` : "";
	let xml = `${indent}<chord xml:id="${id}" dur="${dur}"${dotsAttr}>\n`;

	for (const pitch of chord) {
		const noteId = generateId("note");
		const { pname, oct, accid } = encodePitch(pitch);
		let attrs = `xml:id="${noteId}" oct="${oct}" pname="${pname}"`;
		if (accid) attrs += ` accid="${accid}"`;
		xml += `${indent}    <note ${attrs} />\n`;
	}

	xml += `${indent}</chord>\n`;
	return xml;
};


const encodeEventTerm = (term: ParaffDocument.EventTerm, indent: string): string => {
	if (term.rest || term.space) {
		return encodeNote(term.chord[0] || { phonet: "c", acc: "", octaves: 0, note: 0 }, term.duration, true, indent);
	}

	if (term.chord.length === 0) {
		return "";
	}

	return encodeChord(term.chord, term.duration, indent);
};


const encodeVoice = (voice: ParaffDocument.Voice, layerN: number, indent: string): string => {
	const layerId = generateId("layer");
	let xml = `${indent}<layer xml:id="${layerId}" n="${layerN}">\n`;

	if (voice.terms) {
		for (const term of voice.terms) {
			const eventTerm = term as ParaffDocument.EventTerm;
			if (eventTerm.duration) {
				xml += encodeEventTerm(eventTerm, indent + "    ");
			}
		}
	}

	xml += `${indent}</layer>\n`;
	return xml;
};


const encodeStaff = (voices: ParaffDocument.Voice[], staffN: number, indent: string): string => {
	const staffId = generateId("staff");
	let xml = `${indent}<staff xml:id="${staffId}" n="${staffN}">\n`;

	voices.forEach((voice, vi) => {
		xml += encodeVoice(voice, vi + 1, indent + "    ");
	});

	xml += `${indent}</staff>\n`;
	return xml;
};


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


const encodeMusic = (doc: ParaffDoc, measureN: number = 1): string => {
	if ((doc as any).delimiter) {
		return `<!-- ${(doc as ParaffDocument.Special).delimiter} -->\n`;
	}

	const measure = doc as ParaffDocument.Measure;
	return encodeMeasure(measure, measureN, "                        ");
};


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


export {
	encode,
	encodeMultiple,
	encodeMusic,
	resetIdCounter,
	MEIEncoderOptions,
};

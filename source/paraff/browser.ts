// Paraff parser and MEI encoder
// Browser-compatible version using jison parser

import { ParaffDocument, ParaffDoc } from "./paraff";
import * as grammar from "./grammar.jison.js";

// Token definitions for MEI output
const KEYS: Record<number, string> = {
	0: '0',
	1: '1s',
	2: '2s',
	3: '3s',
	4: '4s',
	5: '5s',
	6: '6s',
	[-1]: '1f',
	[-2]: '2f',
	[-3]: '3f',
	[-4]: '4f',
	[-5]: '5f',
	[-6]: '6f'
};

const CLEF_SHAPES: Record<string, { shape: string; line: number }> = {
	Cg: { shape: 'G', line: 2 },
	Cf: { shape: 'F', line: 4 },
	Cc: { shape: 'C', line: 3 }
};

const DURATION_VALUES: Record<number, string> = {
	[-2]: 'breve',
	[-1]: '1',
	0: '1',
	1: '2',
	2: '4',
	3: '8',
	4: '16',
	5: '32',
	6: '64',
	7: '128'
};

// Accidental mappings
const ACCIDENTALS: Record<string, string> = {
	s: 's',
	f: 'f',
	n: 'n',
	ss: 'ss',
	ff: 'ff'
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

// Convert ParaffDocument.Pitch to ParsedPitch
function convertPitch(pitch: ParaffDocument.Pitch): ParsedPitch {
	const pname = pitch.phonet.toLowerCase();
	// note field is relative to C4 (middle C), where C4=0, D4=1, ..., B4=6, C5=7
	const oct = 4 + Math.floor(pitch.note / 7);
	const accid = pitch.acc ? ACCIDENTALS[pitch.acc] : undefined;
	return { pname, oct, accid };
}

// Convert ParaffDocument.EventTerm to ParsedNote
function convertEventTerm(term: ParaffDocument.EventTerm): ParsedNote {
	const pitches = term.chord.map(convertPitch);
	const dur = DURATION_VALUES[term.duration?.division ?? 2] || '4';
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
}

// Convert ParaffDocument.Measure to ParsedMeasure
function convertMeasure(measure: ParaffDocument.Measure): ParsedMeasure {
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
}

// Parse paraff code using jison grammar
function parseWithGrammar(code: string): ParaffDoc | null {
	try {
		return grammar.parse(code);
	} catch (e) {
		console.error('Parse error:', e);
		return null;
	}
}

export function parseParaff(code: string): ParsedMeasure | null {
	const doc = parseWithGrammar(code);
	if (!doc) return null;

	// Check if it's a special delimiter
	if ((doc as ParaffDocument.Special).delimiter) {
		return null;
	}

	const measure = doc as ParaffDocument.Measure;
	return convertMeasure(measure);
}

export function parseParaffScore(code: string): ParsedScore | null {
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
}

let idCounter = 0;

function generateId(prefix: string): string {
	return `${prefix}-${String(++idCounter).padStart(10, '0')}`;
}

// Helper to build a single note element
function buildNoteElement(pitch: ParsedPitch, dur: string, note: ParsedNote, indent: string, inChord: boolean, layerStaff?: number): string {
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
		result += `${indent}    <dynam xml:id="${generateId('dynam')}"  >sf</dynam>\n`;
	}

	result += `${indent}</note>\n`;

	return result;
}

function noteToMEI(note: ParsedNote, indent: string, layerStaff?: number): string {
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
		result += `${indent}    <dynam xml:id="${generateId('dynam')}"  >sf</dynam>\n`;
	}

	result += `${indent}</chord>\n`;

	return clefOutput + result;
}

export function toMEI(measure: ParsedMeasure): string {
	idCounter = 0;

	const keySig = KEYS[measure.key] || '0';

	let staffDefs = '';
	for (let s = 1; s <= measure.staffN; s++) {
		const clef = measure.staffClefs[s] || 'Cg';
		const clefInfo = CLEF_SHAPES[clef] || CLEF_SHAPES['Cg'];
		staffDefs += `                            <staffDef xml:id="${generateId('staffdef')}" n="${s}" lines="5" clef.shape="${clefInfo.shape}" clef.line="${clefInfo.line}" />\n`;
	}

	let mei = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
    <meiHead>
        <fileDesc>
            <titleStmt>
                <title>Paraff Live Editor</title>
            </titleStmt>
            <pubStmt />
        </fileDesc>
    </meiHead>
    <music>
        <body>
            <mdiv xml:id="${generateId('mdiv')}">
                <score xml:id="${generateId('score')}">
                    <scoreDef xml:id="${generateId('scoredef')}" key.sig="${keySig}" meter.count="${measure.timeNum}" meter.unit="${measure.timeDen}">
                        <staffGrp xml:id="${generateId('staffgrp')}">
${staffDefs}                        </staffGrp>
                    </scoreDef>
                    <section xml:id="${generateId('section')}">
                        <measure xml:id="${generateId('measure')}" n="1">
`;

	const indent = '                                    ';

	const voicesByStaff: Record<number, { voiceIdx: number; notes: ParsedNote[] }[]> = {};

	measure.notes.forEach((voice, vi) => {
		const staffNum = measure.voiceStaff[vi] || 1;
		if (!voicesByStaff[staffNum]) {
			voicesByStaff[staffNum] = [];
		}
		voicesByStaff[staffNum].push({ voiceIdx: vi, notes: voice });
	});

	for (let s = 1; s <= measure.staffN; s++) {
		mei += `                            <staff xml:id="${generateId('staff')}" n="${s}">\n`;

		const voices = voicesByStaff[s] || [];
		voices.forEach((v, layerIdx) => {
			mei += `                                <layer xml:id="${generateId('layer')}" n="${layerIdx + 1}">\n`;

			const voiceDynamics = measure.dynamics?.filter(d => d.voiceIdx === v.voiceIdx) || [];

			v.notes.forEach((note, noteIdx) => {
				const dynamicsHere = voiceDynamics.filter(d => d.noteIdx === noteIdx);
				for (const dyn of dynamicsHere) {
					const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
					mei += `${indent}<dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
				}

				mei += noteToMEI(note, indent, s);
			});

			const dynamicsAtEnd = voiceDynamics.filter(d => d.noteIdx >= v.notes.length);
			for (const dyn of dynamicsAtEnd) {
				const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
				mei += `${indent}<dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
			}

			mei += `                                </layer>\n`;
		});

		if (voices.length === 0) {
			mei += `                                <layer xml:id="${generateId('layer')}" n="1" />\n`;
		}

		mei += `                            </staff>\n`;
	}

	mei += `                        </measure>
                    </section>
                </score>
            </mdiv>
        </body>
    </music>
</mei>`;

	return mei;
}

export function scoreToMEI(score: ParsedScore): string {
	idCounter = 0;

	if (score.measures.length === 0) return '';

	const firstMeasure = score.measures[0];
	const keySig = KEYS[firstMeasure.key] || '0';

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

	let staffDefs = '';
	for (let s = 1; s <= maxStaffN; s++) {
		const clef = staffClefs[s] || 'Cg';
		const clefInfo = CLEF_SHAPES[clef] || CLEF_SHAPES['Cg'];
		staffDefs += `                            <staffDef xml:id="${generateId('staffdef')}" n="${s}" lines="5" clef.shape="${clefInfo.shape}" clef.line="${clefInfo.line}" />\n`;
	}

	let mei = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
    <meiHead>
        <fileDesc>
            <titleStmt>
                <title>Paraff Live Editor</title>
            </titleStmt>
            <pubStmt />
        </fileDesc>
    </meiHead>
    <music>
        <body>
            <mdiv xml:id="${generateId('mdiv')}">
                <score xml:id="${generateId('score')}">
                    <scoreDef xml:id="${generateId('scoredef')}" key.sig="${keySig}" meter.count="${firstMeasure.timeNum}" meter.unit="${firstMeasure.timeDen}">
                        <staffGrp xml:id="${generateId('staffgrp')}">
${staffDefs}                        </staffGrp>
                    </scoreDef>
                    <section xml:id="${generateId('section')}">
`;

	const indent = '                                    ';

	score.measures.forEach((measure, mi) => {
		mei += `                        <measure xml:id="${generateId('measure')}" n="${mi + 1}">\n`;

		const voicesByStaff: Record<number, { voiceIdx: number; notes: ParsedNote[] }[]> = {};

		measure.notes.forEach((voice, vi) => {
			const staffNum = measure.voiceStaff[vi] || 1;
			if (!voicesByStaff[staffNum]) {
				voicesByStaff[staffNum] = [];
			}
			voicesByStaff[staffNum].push({ voiceIdx: vi, notes: voice });
		});

		for (let s = 1; s <= maxStaffN; s++) {
			mei += `                            <staff xml:id="${generateId('staff')}" n="${s}">\n`;

			const voices = voicesByStaff[s] || [];
			voices.forEach((v, layerIdx) => {
				mei += `                                <layer xml:id="${generateId('layer')}" n="${layerIdx + 1}">\n`;

				const voiceDynamics = measure.dynamics?.filter(d => d.voiceIdx === v.voiceIdx) || [];

				v.notes.forEach((note, noteIdx) => {
					const dynamicsHere = voiceDynamics.filter(d => d.noteIdx === noteIdx);
					for (const dyn of dynamicsHere) {
						const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
						mei += `${indent}<dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
					}

					mei += noteToMEI(note, indent, s);
				});

				const dynamicsAtEnd = voiceDynamics.filter(d => d.noteIdx >= v.notes.length);
				for (const dyn of dynamicsAtEnd) {
					const dynWord = DYNAMIC_WORDS_MAP[dyn.type] || dyn.type;
					mei += `${indent}<dynam xml:id="${generateId('dynam')}">${dynWord}</dynam>\n`;
				}

				mei += `                                </layer>\n`;
			});

			if (voices.length === 0) {
				mei += `                                <layer xml:id="${generateId('layer')}" n="1" />\n`;
			}

			mei += `                            </staff>\n`;
		}

		mei += `                        </measure>\n`;
	});

	mei += `                    </section>
                </score>
            </mdiv>
        </body>
    </music>
</mei>`;

	return mei;
}

export function paraffToMEI(code: string): string | null {
	const score = parseParaffScore(code);
	if (score && score.measures.length > 1) {
		return scoreToMEI(score);
	}

	const parsed = parseParaff(code);
	if (!parsed) return null;
	return toMEI(parsed);
}

// Export types for external use
export type { ParsedNote, ParsedMeasure, ParsedScore };

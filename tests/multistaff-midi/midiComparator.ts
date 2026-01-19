// MIDI file parser and comparator
// Extracts note onset information and compares two MIDI files

import * as fs from "fs";

// Simple MIDI parser (based on midi-parser-js concepts but custom implementation)
// MIDI file format reference: https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf

interface MIDINote {
	track: number;
	channel: number;
	pitch: number;    // MIDI pitch number (60 = middle C)
	velocity: number;
	onsetTick: number;
	durationTick: number;
	onsetTime: number;  // in seconds
}

interface MIDIFile {
	format: number;
	tracks: number;
	ticksPerQuarter: number;
	tempo: number;  // microseconds per quarter note
	notes: MIDINote[];
}

// Read variable length quantity
function readVLQ(buffer: Buffer, offset: number): { value: number; length: number } {
	let value = 0;
	let length = 0;
	let byte: number;

	do {
		byte = buffer[offset + length];
		value = (value << 7) | (byte & 0x7F);
		length++;
	} while (byte & 0x80);

	return { value, length };
}

// Parse MIDI file
export function parseMIDI(buffer: Buffer): MIDIFile {
	// Check header
	if (buffer.toString("ascii", 0, 4) !== "MThd") {
		throw new Error("Invalid MIDI file: missing MThd header");
	}

	const headerLength = buffer.readUInt32BE(4);
	const format = buffer.readUInt16BE(8);
	const tracks = buffer.readUInt16BE(10);
	const timeDivision = buffer.readUInt16BE(12);

	// Handle ticks per quarter (assuming no SMPTE)
	const ticksPerQuarter = timeDivision & 0x7FFF;

	const result: MIDIFile = {
		format,
		tracks,
		ticksPerQuarter,
		tempo: 500000, // Default 120 BPM
		notes: [],
	};

	let offset = 8 + headerLength;

	// Parse tracks
	for (let trackIdx = 0; trackIdx < tracks; trackIdx++) {
		if (offset >= buffer.length) break;

		const trackHeader = buffer.toString("ascii", offset, offset + 4);
		if (trackHeader !== "MTrk") {
			console.warn(`Expected MTrk at offset ${offset}, got ${trackHeader}`);
			break;
		}

		const trackLength = buffer.readUInt32BE(offset + 4);
		offset += 8;

		const trackEnd = offset + trackLength;
		let currentTick = 0;
		let runningStatus = 0;

		// Track active notes for calculating durations
		const activeNotes: Map<string, { pitch: number; velocity: number; onsetTick: number; channel: number }> = new Map();

		while (offset < trackEnd) {
			// Read delta time
			const delta = readVLQ(buffer, offset);
			currentTick += delta.value;
			offset += delta.length;

			if (offset >= trackEnd) break;

			let status = buffer[offset];

			// Handle running status
			if (status < 0x80) {
				status = runningStatus;
			} else {
				runningStatus = status;
				offset++;
			}

			const statusType = status & 0xF0;
			const channel = status & 0x0F;

			switch (statusType) {
				case 0x90: { // Note On
					const pitch = buffer[offset++];
					const velocity = buffer[offset++];

					if (velocity > 0) {
						const key = `${trackIdx}-${channel}-${pitch}`;
						activeNotes.set(key, { pitch, velocity, onsetTick: currentTick, channel });
					} else {
						// Note On with velocity 0 = Note Off
						const key = `${trackIdx}-${channel}-${pitch}`;
						const noteOn = activeNotes.get(key);
						if (noteOn) {
							const onsetTime = (noteOn.onsetTick / ticksPerQuarter) * (result.tempo / 1000000);
							result.notes.push({
								track: trackIdx,
								channel,
								pitch: noteOn.pitch,
								velocity: noteOn.velocity,
								onsetTick: noteOn.onsetTick,
								durationTick: currentTick - noteOn.onsetTick,
								onsetTime,
							});
							activeNotes.delete(key);
						}
					}
					break;
				}
				case 0x80: { // Note Off
					const pitch = buffer[offset++];
					offset++; // velocity (ignored)

					const key = `${trackIdx}-${channel}-${pitch}`;
					const noteOn = activeNotes.get(key);
					if (noteOn) {
						const onsetTime = (noteOn.onsetTick / ticksPerQuarter) * (result.tempo / 1000000);
						result.notes.push({
							track: trackIdx,
							channel,
							pitch: noteOn.pitch,
							velocity: noteOn.velocity,
							onsetTick: noteOn.onsetTick,
							durationTick: currentTick - noteOn.onsetTick,
							onsetTime,
						});
						activeNotes.delete(key);
					}
					break;
				}
				case 0xA0: // Aftertouch
				case 0xB0: // Control Change
				case 0xE0: // Pitch Bend
					offset += 2;
					break;
				case 0xC0: // Program Change
				case 0xD0: // Channel Pressure
					offset += 1;
					break;
				case 0xF0: { // System/Meta events
					if (status === 0xFF) { // Meta event
						const metaType = buffer[offset++];
						const metaLength = readVLQ(buffer, offset);
						offset += metaLength.length;

						if (metaType === 0x51 && metaLength.value === 3) {
							// Tempo change
							result.tempo = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
						}

						offset += metaLength.value;
					} else if (status === 0xF0 || status === 0xF7) { // SysEx
						const sysexLength = readVLQ(buffer, offset);
						offset += sysexLength.length + sysexLength.value;
					}
					break;
				}
			}
		}

		// Handle any remaining active notes (shouldn't happen in well-formed MIDI)
		for (const [key, noteOn] of activeNotes) {
			const onsetTime = (noteOn.onsetTick / ticksPerQuarter) * (result.tempo / 1000000);
			result.notes.push({
				track: parseInt(key.split("-")[0]),
				channel: noteOn.channel,
				pitch: noteOn.pitch,
				velocity: noteOn.velocity,
				onsetTick: noteOn.onsetTick,
				durationTick: currentTick - noteOn.onsetTick,
				onsetTime,
			});
		}

		offset = trackEnd;
	}

	// Sort notes by onset time, then by pitch
	result.notes.sort((a, b) => {
		if (a.onsetTick !== b.onsetTick) return a.onsetTick - b.onsetTick;
		return a.pitch - b.pitch;
	});

	return result;
}

// Parse MIDI from file path
export function parseMIDIFile(filePath: string): MIDIFile {
	const buffer = fs.readFileSync(filePath);
	return parseMIDI(buffer);
}

// Parse MIDI from base64 string
export function parseMIDIBase64(base64: string): MIDIFile {
	const buffer = Buffer.from(base64, "base64");
	return parseMIDI(buffer);
}

// Extract onset information for comparison
export interface OnsetInfo {
	tick: number;
	pitches: number[];  // Sorted pitches at this onset
}

export function extractOnsets(midi: MIDIFile): OnsetInfo[] {
	const onsetMap = new Map<number, number[]>();

	for (const note of midi.notes) {
		if (!onsetMap.has(note.onsetTick)) {
			onsetMap.set(note.onsetTick, []);
		}
		onsetMap.get(note.onsetTick)!.push(note.pitch);
	}

	const onsets: OnsetInfo[] = [];
	for (const [tick, pitches] of onsetMap) {
		onsets.push({ tick, pitches: pitches.sort((a, b) => a - b) });
	}

	return onsets.sort((a, b) => a.tick - b.tick);
}

// Convert pitch to note name
export function pitchToName(pitch: number): string {
	const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	const octave = Math.floor(pitch / 12) - 1;
	const note = names[pitch % 12];
	return `${note}${octave}`;
}

// Normalize ticks to a common base (e.g., 480 ticks per quarter)
export function normalizeOnsets(onsets: OnsetInfo[], sourceTpq: number, targetTpq: number = 480): OnsetInfo[] {
	const scale = targetTpq / sourceTpq;
	return onsets.map(o => ({
		tick: Math.round(o.tick * scale),
		pitches: o.pitches,
	}));
}

// Compare two onset sequences
export interface ComparisonResult {
	match: boolean;
	lilypond: OnsetInfo[];
	mei: OnsetInfo[];
	differences: {
		type: "missing_in_mei" | "missing_in_lilypond" | "pitch_mismatch" | "timing_mismatch";
		tick: number;
		lilypond?: number[];
		mei?: number[];
		detail: string;
	}[];
}

export function compareOnsets(lilypondOnsets: OnsetInfo[], meiOnsets: OnsetInfo[], lilypondTpq: number = 384, meiTpq: number = 120): ComparisonResult {
	// Normalize both to common tick base (480)
	const normalizedLy = normalizeOnsets(lilypondOnsets, lilypondTpq, 480);
	const normalizedMei = normalizeOnsets(meiOnsets, meiTpq, 480);
	const result: ComparisonResult = {
		match: true,
		lilypond: normalizedLy,
		mei: normalizedMei,
		differences: [],
	};

	// Create maps for easy lookup using normalized onsets
	const lyMap = new Map<number, number[]>();
	const meiMap = new Map<number, number[]>();

	for (const onset of normalizedLy) {
		lyMap.set(onset.tick, onset.pitches);
	}
	for (const onset of normalizedMei) {
		meiMap.set(onset.tick, onset.pitches);
	}

	// Check all LilyPond onsets
	for (const [tick, pitches] of lyMap) {
		const meiPitches = meiMap.get(tick);
		if (!meiPitches) {
			result.match = false;
			result.differences.push({
				type: "missing_in_mei",
				tick,
				lilypond: pitches,
				detail: `Notes at tick ${tick} missing in MEI: ${pitches.map(pitchToName).join(", ")}`,
			});
		} else {
			// Compare pitches
			const lySet = new Set(pitches);
			const meiSet = new Set(meiPitches);

			const missingInMEI = pitches.filter(p => !meiSet.has(p));
			const extraInMEI = meiPitches.filter(p => !lySet.has(p));

			if (missingInMEI.length > 0 || extraInMEI.length > 0) {
				result.match = false;
				result.differences.push({
					type: "pitch_mismatch",
					tick,
					lilypond: pitches,
					mei: meiPitches,
					detail: `Pitch mismatch at tick ${tick}: LilyPond [${pitches.map(pitchToName).join(", ")}] vs MEI [${meiPitches.map(pitchToName).join(", ")}]`,
				});
			}
		}
	}

	// Check for extra MEI onsets
	for (const [tick, pitches] of meiMap) {
		if (!lyMap.has(tick)) {
			result.match = false;
			result.differences.push({
				type: "missing_in_lilypond",
				tick,
				mei: pitches,
				detail: `Notes at tick ${tick} missing in LilyPond: ${pitches.map(pitchToName).join(", ")}`,
			});
		}
	}

	// Sort differences by tick
	result.differences.sort((a, b) => a.tick - b.tick);

	return result;
}

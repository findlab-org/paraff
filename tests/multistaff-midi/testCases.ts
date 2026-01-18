// Test cases for multi-staff MIDI verification
// From simple to complex

export interface TestCase {
	name: string;
	description: string;
	paraff: string;
	expectedStaves: number;
	expectedNotes: number;  // Total notes across all staves
}

export const testCases: TestCase[] = [
	// Level 1: Single staff, single voice, simple notes
	{
		name: "single-note",
		description: "Single quarter note C",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 EOM",
		expectedStaves: 1,
		expectedNotes: 1,
	},
	{
		name: "simple-melody",
		description: "Simple C major scale fragment",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 d D4 e D4 f D4 EOM",
		expectedStaves: 1,
		expectedNotes: 4,
	},
	{
		name: "dotted-note",
		description: "Dotted half note",
		paraff: "BOM K0 TN3 TD4 S1 Cg c D2 Dot EOM",
		expectedStaves: 1,
		expectedNotes: 1,
	},

	// Level 2: Single staff with chord
	{
		name: "simple-chord",
		description: "C major triad",
		paraff: "BOM K0 TN4 TD4 S1 Cg c e g D4 EOM",
		expectedStaves: 1,
		expectedNotes: 3,
	},
	{
		name: "melody-with-chord",
		description: "Melody followed by chord",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 d D4 e g D2 EOM",
		expectedStaves: 1,
		expectedNotes: 4,  // c, d, e+g chord
	},

	// Level 3: Different clefs (bass notes use Osub for lower octave)
	{
		name: "bass-clef",
		description: "Single note in bass clef",
		paraff: "BOM K0 TN4 TD4 S1 Cf c Osub D4 EOM",
		expectedStaves: 1,
		expectedNotes: 1,
	},
	{
		name: "bass-melody",
		description: "Simple bass line",
		paraff: "BOM K0 TN4 TD4 S1 Cf c Osub D4 g D4 c Osup D2 EOM",
		expectedStaves: 1,
		expectedNotes: 3,
	},

	// Level 4: Two staves (piano-style)
	{
		name: "two-staff-simple",
		description: "Two staves with simple notes",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 VB S2 Cf c Osub D4 EOM",
		expectedStaves: 2,
		expectedNotes: 2,
	},
	{
		name: "two-staff-melody",
		description: "Treble melody with bass note",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 d D4 e D4 f D4 VB S2 Cf c Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
	{
		name: "two-staff-chord",
		description: "Treble with chord in bass",
		paraff: "BOM K0 TN4 TD4 S1 Cg g D4 VB S2 Cf c Osub e g D4 EOM",
		expectedStaves: 2,
		expectedNotes: 4,  // g + c-e-g chord
	},

	// Level 5: Complex multi-staff from Bach
	{
		name: "bach-measure-1",
		description: "Bach chorale first measure",
		paraff: "BOM K1 TN3 TD4 S1 Cg Md d Osup D4 Mu g Osub D8 a D8 b D8 c D8 VB S2 Cf Md g b d D2 a D4 EOM",
		expectedStaves: 2,
		expectedNotes: 8,  // 5 treble + 3 bass (chord g-b-d + a)
	},
	{
		name: "bach-measure-2",
		description: "Bach chorale with staccato",
		paraff: "BOM K1 TN3 TD4 S1 Cg Md d Osup D4 Mu g Osub D4 Est g D4 Est VB S2 Cf Md b D2 Dot EOM",
		expectedStaves: 2,
		expectedNotes: 4,  // d, g, g, b
	},
	{
		name: "bach-measure-3",
		description: "Bach chorale with accidentals",
		paraff: "BOM K1 TN3 TD4 S1 Cg Mu f As D4 g D8 a D8 b D8 g D8 VB S2 Cf Md d D4 b D4 g D4 EOM",
		expectedStaves: 2,
		expectedNotes: 9,  // 6 treble + 3 bass
	},
	{
		name: "bach-measure-final",
		description: "Bach chorale final measure with chord",
		paraff: "BOM K1 TN3 TD4 S1 Cg Mu b d g D2 Dot VB S2 Cf Md g D2 Dot EOM",
		expectedStaves: 2,
		expectedNotes: 4,  // b-d-g chord + g
	},

	// Level 6: Complex rhythms
	{
		name: "mixed-durations",
		description: "Mixed note durations",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D2 d D4 e D8 f D8 VB S2 Cf c Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
	{
		name: "sixteenth-notes",
		description: "Sixteenth note passage",
		paraff: "BOM K0 TN4 TD4 S1 Cg c D16 d D16 e D16 f D16 g D4 VB S2 Cf c Osub D2 EOM",
		expectedStaves: 2,
		expectedNotes: 6,
	},

	// Level 7: Key signatures
	{
		name: "key-one-sharp",
		description: "G major key signature",
		paraff: "BOM K1 TN4 TD4 S1 Cg g D4 a D4 b D4 d Osup D4 VB S2 Cf g Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
	{
		name: "key-two-flats",
		description: "B-flat major key signature",
		paraff: "BOM K_2 TN4 TD4 S1 Cg b D4 c D4 d D4 e D4 VB S2 Cf b Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},

	// Level 8: Cross-staff support
	{
		name: "cross-staff-basic",
		description: "Voice 1 with notes crossing to staff 2",
		// Voice 1 on staff 1: c4, d4, then switches to staff 2 for e4, then back to staff 1 for f4
		paraff: "BOM K0 TN4 TD4 S1 Cg c D4 d D4 S2 e D4 S1 f D4 VB S2 Cf c Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
	{
		name: "cross-staff-chord",
		description: "Chord with cross-staff notes",
		// Voice 1 starts on staff 1, voice 2 on staff 2 with independent melody
		paraff: "BOM K0 TN4 TD4 S1 Cg g D4 S2 c D4 S1 d D4 e D4 VB S2 Cf c Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
	{
		name: "cross-staff-relative-pitch",
		description: "Cross-staff with relative pitch (b->c octave wrap)",
		// Tests relative pitch: treble plays b4, then crosses to staff 2 for c5 (b->c should wrap octave)
		// Voice 1: a4, b4, cross to staff 2 for c5, back to staff 1 for d5
		paraff: "BOM K0 TN4 TD4 S1 Cg a D4 b D4 S2 c D4 S1 d D4 VB S2 Cf c Osub D1 EOM",
		expectedStaves: 2,
		expectedNotes: 5,
	},
];

export default testCases;

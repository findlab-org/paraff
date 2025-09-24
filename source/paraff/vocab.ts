
enum Token {
	// special
	PAD,
	MSUM,	// summary of a measure
	BOS,	// begin of score
	EOS,	// end of score
	BOM,	// begin of measure
	EOM,	// end of measure
	VB,		// voice boundary

	// Staff	(context)
	S1,
	S2,
	S3,

	// Clefs	(context)
	Cg,
	Cf,
	Cc,

	// Keys		(measure-level)
	K0,
	K1, K2, K3, K4, K5, K6,
	K_1, K_2, K_3, K_4, K_5, K_6,

	// TimeSignatures, numerators & denominators	(measure-level)
	TN1, TN2, TN3, TN4, TN5, TN6, TN7, TN8, TN9, TN10, TN11, TN12,
	TD2, TD4, TD8, TD16,

	// Pitches
	a, b, c, d, e, f, g,

	// Accidentals
	As, Af, Ass, Aff,

	// Octaves
	Osup, Osub,
	O0, Ova, Ovb,	//	(context)

	// Duration
	D1, D2, D4, D8, D16, D32, D64, D128, D256,
	Dot,

	// Beams
	Bl,
	Br,

	// Stem Direction
	Mu,
	Md,

	// Rest
	Rest,
	RSpace,	// invisible rest

	// TimeWarps	(context)
	W2, W3, W4, W5, W6, W7, W8, W9, W10, W12, W16, W24, W32, Wx,
	W,

	// Grace
	G,

	// Tremolos
	// TM: tremolo single, TC: tremolo double
	TM8, TM16, TM32, TM64, TM128, TM256,
	TC8, TC16, TC32, TC64, TC128, TC256,

	// Expressive marks & Articulations
	EslurL,	// slur begin
	EslurR,	// slur end
	Etie,	// tie
	Earp,	// arpeggio
	Etr,	// trill
	Efer,	// fermata
	Esf,	// short fermata
	Est,	// staccato
	Estm,	// staccatissimo
	Eac,	// accent
	Emor,	// mordent
	Epr,	// prall
	Eturn,	// turn
	Epor,	// portato
	Eten,	// tenuto
	Emar,	// marcato
	Ecre,	// crescendo
	Edim,	// diminuendo
	Ecds,	// crescendo/diminuendo stop
	EDf, EDp, EDm, EDr, EDs, EDz,	// dynamics
	EsusOn, EsusOff,				// pedals
};


enum PromptToken {
	SingleStaff			= "#single-staff",
	DoubleStaff			= "#double-staff",
	TripleStaff			= "#triple-staff",

	PolyVoice			= "#polyvoice",
	MonoVoice			= "#monovoice",

	Rhythm1				= "#1st-rhythm",
	Rhythm2				= "#2nd-rhythm",
	Rhythm4				= "#4th-rhythm",
	Rhythm8				= "#8th-rhythm",
	Rhythm16			= "#16th-rhythm",
	Rhythm32			= "#32th-rhythm",
	Rhythm64			= "#64th-rhythm",

	Grace				= "#grace",
	noGrace				= "#non-grace",

	Tremolo				= "#tremolo",
	noTremolo			= "#non-tremolo",

	Timewarp			= "#timewarp",
	noTimewarp			= "#non-timewarp",

	Dot					= "#dot",
	noDot				= "#non-dot",

	OctaveShift			= "#octave-shift",
	noOctaveShift		= "#non-octave-shift",

	Partial				= "#partial",
	Full				= "#full",

	Patched				= "#patched",
	Complicated			= "#complicated",
	CrossStaves			= "#cross-staves",
};


enum Phase {
	PAD,
	BOS,
	EOS,
	Measure,
};


const TOKENS = Object.values(Token).filter(k => typeof k === "string") as string[];
const PHASES = Object.values(Phase).filter(k => typeof k === "string") as string[];


type TokenTable = Record<number, Token>;


// value-token tables
const TokenStaff: TokenTable = [Token.S1, Token.S2, Token.S3];

const TokenClef: TokenTable = {
	[0]: Token.Cc,
	[-3]: Token.Cg,
	[3]: Token.Cf,
};

const TokenKey: TokenTable = {
	[0]: Token.K0,
	[1]: Token.K1,
	[2]: Token.K2,
	[3]: Token.K3,
	[4]: Token.K4,
	[5]: Token.K5,
	[6]: Token.K6,
	[-1]: Token.K_1,
	[-2]: Token.K_2,
	[-3]: Token.K_3,
	[-4]: Token.K_4,
	[-5]: Token.K_5,
	[-6]: Token.K_6,
};

const TokenNumerator: TokenTable = {
	[1]: Token.TN1,
	[2]: Token.TN2,
	[3]: Token.TN3,
	[4]: Token.TN4,
	[5]: Token.TN5,
	[6]: Token.TN6,
	[7]: Token.TN7,
	[8]: Token.TN8,
	[9]: Token.TN9,
	[10]: Token.TN10,
	[11]: Token.TN11,
	[12]: Token.TN12,
};

const TokenDenominator: TokenTable = {
	[2]: Token.TD2,
	[4]: Token.TD4,
	[8]: Token.TD8,
	[16]: Token.TD16,
};

const TokenDivision: TokenTable = {
	[0]: Token.D1,
	[1]: Token.D2,
	[2]: Token.D4,
	[3]: Token.D8,
	[4]: Token.D16,
	[5]: Token.D32,
	[6]: Token.D64,
	[7]: Token.D128,
	[8]: Token.D256,
};

const TokenTimewarp: TokenTable = {
	[2]: Token.W2,
	[3]: Token.W3,
	[4]: Token.W4,
	[5]: Token.W5,
	[6]: Token.W6,
	[7]: Token.W7,
	[8]: Token.W8,
	[9]: Token.W9,
	[10]: Token.W10,
	[12]: Token.W12,
	[16]: Token.W16,
	[24]: Token.W24,
	[32]: Token.W32,
};

const TokenOctaveShift: TokenTable = {
	[0]: Token.O0,
	[-1]: Token.Ova,
	[1]: Token.Ovb,
};

const TokenTremolo: TokenTable = {
	[3]: Token.TM8,
	[4]: Token.TM16,
	[5]: Token.TM32,
	[6]: Token.TM64,
	[7]: Token.TM128,
	[8]: Token.TM256,
};

const TokenTremoloCast: TokenTable = {
	[3]: Token.TC8,
	[4]: Token.TC16,
	[5]: Token.TC32,
	[6]: Token.TC64,
	[7]: Token.TC128,
	[8]: Token.TC256,
};

const TokenPhonet: TokenTable = [Token.c, Token.d, Token.e, Token.f, Token.g, Token.a, Token.b];

const TokenAccidental: TokenTable = {
	[1]: Token.As,
	[2]: Token.Ass,
	[-1]: Token.Af,
	[-2]: Token.Aff,
};


const Token2Value = [TokenStaff, TokenClef, TokenKey, TokenNumerator, TokenDenominator, TokenDivision, TokenTimewarp, TokenOctaveShift, TokenPhonet, TokenAccidental, TokenTremolo, TokenTremoloCast]
	.reduce((table, t) => {
		for (const v of Object.keys(t))
			table[t[v]] = Number(v);

		return table;
	}, {} as Record<Token, number>);


const MeasureLevelTokens = ([] as Token[]).concat(...[TokenKey, TokenNumerator, TokenDenominator].map(t => Object.values(t)));


const isTokenOf = (tt: TokenTable) => {
	const values = Object.values(tt);
	return (token: Token): boolean => values.includes(token);
};



export {
	Token,
	TOKENS,
	TokenStaff,
	TokenClef,
	TokenKey,
	TokenNumerator,
	TokenDenominator,
	TokenDivision,
	TokenTimewarp,
	TokenOctaveShift,
	TokenTremolo,
	TokenTremoloCast,
	TokenPhonet,
	TokenAccidental,
	Token2Value,
	MeasureLevelTokens,
	isTokenOf,
	PromptToken,
	Phase,
	PHASES,
};

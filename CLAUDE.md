# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PARAFF is a domain-specific language for sheet music designed for algorithmic musical composition. It serves as a tokenized music representation format (< 256 tokens) suitable for AI/ML models, bridging ABC notation and Lilypond output.

## Commands

```bash
# Install dependencies and build Jison grammars (grammars build automatically via postinstall)
yarn install

# Run parser tests
yarn test

# Run any TypeScript file
yarn ts <file.ts>

# Convert ABC to Paraff
yarn ts ./tools/abcToParaff.ts <file.abc>

# Convert Paraff YAML to Lilypond
yarn ts ./tools/paraffToLilypond.ts <source.yaml> <output-dir>

# Serialize Paraff to binary format
yarn ts ./tools/paraffTokenizer.ts <source.yaml>
```

## Architecture

### Data Flow
```
ABC Notation → ABC AST → Paraff Tokens → Paraff AST → Lilypond
     ↓              ↓            ↓              ↓
  abc.jison    abc/parser   paraff.jison   lilypondEncoder
```

### Key Modules

- **source/paraff/** - Core DSL: parser, token definitions (vocab.ts), Lilypond encoder, AI composer
- **source/abc/** - ABC notation parser and Paraff encoder
- **source/stochastic/** - Probabilistic utilities for composition (weighted sampling, random distributions)
- **source/fraction.ts** - Fraction arithmetic for musical timing
- **tools/** - CLI utilities for conversion and build

### Grammar System

JISON (Bison/Yacc equivalent) generates parsers from `.jison` grammar files:
- `source/paraff/paraff.jison` - Paraff grammar
- `source/abc/abc.jison` - ABC notation grammar

Grammars compile to `grammar.jison.js` files at install time. After modifying `.jison` files, run `yarn ts ./tools/buildJisonParser.ts`.

### Token System

All tokens defined in `source/paraff/vocab.ts` as enums. Token names use capital case (BOM, EOM, K0, TN4, TD8). The tokenTransfer.ts module enforces grammar constraints for valid token sequences.

### Key Concepts

- **Measure-based structure**: Scores organized by measures with multiple voices per measure
- **Context vs Events**: Terms split into context (key, time sig, clef) and events (notes)
- **Multi-staff support**: Up to 3 staves per measure with voice changes (VB separator)

## Code Patterns

TypeScript namespace pattern for type groupings:
```typescript
namespace ParaffDocument {
  export interface Pitch { ... }
  export const serializeMeasure = (...) => { ... }
}
```

Function naming: `serialize*`, `parse*`, `encode*`, `decode*`, `stringify*`, `deduce*`

# Prompt Template for Gemini

Copy and paste this prompt when asking Gemini to generate code:

---

```
Before generating any code, you MUST:

1. Read GEMINI_INSTRUCTIONS.md completely - it has copy-paste templates
2. Read GEMINI_CRITICAL_PATTERNS.md - it addresses common errors
3. Reference the actual working code examples with line numbers

CRITICAL RULES:
- Async functions → Interface: Promise<void>, Implementation: async
- Sync functions → Interface: void, Implementation: no async
- Partial<Shape> spreads → MUST use "as Shape" assertion
- All parameters must match exactly between interface and implementation
- Paper.js operations → Use type guards, check for null

When generating code:
- Copy the exact patterns from the working examples
- Use the line number references to see actual code
- Follow the pre-submission checklist
- If you're unsure, copy the pattern from the working code

Now, [YOUR REQUEST HERE]
```

---

## Example Usage

```
Before generating any code, you MUST:

1. Read GEMINI_INSTRUCTIONS.md completely - it has copy-paste templates
2. Read GEMINI_CRITICAL_PATTERNS.md - it addresses common errors
3. Reference the actual working code examples with line numbers

CRITICAL RULES:
- Async functions → Interface: Promise<void>, Implementation: async
- Sync functions → Interface: void, Implementation: no async
- Partial<Shape> spreads → MUST use "as Shape" assertion
- All parameters must match exactly between interface and implementation
- Paper.js operations → Use type guards, check for null

When generating code:
- Copy the exact patterns from the working examples
- Use the line number references to see actual code
- Follow the pre-submission checklist
- If you're unsure, copy the pattern from the working code

Now, add a new function called "rotateSelection" that rotates selected shapes by a given angle in degrees.
```

---

## Why This Works

1. **Explicit Instructions** - Tells Gemini exactly what to read first
2. **Critical Rules Upfront** - Most common errors listed immediately
3. **Reference to Working Code** - Points to actual examples, not just descriptions
4. **Copy-Paste Emphasis** - Encourages using exact patterns instead of inventing new ones





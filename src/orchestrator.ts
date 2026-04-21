import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

// Load all templates from /templates directory
interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  composable_with: string[];
  complexity: string;
  anchor_version: string;
  dependencies: Record<string, string>;
}

interface Template {
  meta: TemplateMeta;
  code: string;
}

function loadTemplates(): Template[] {
  const templatesDir = path.join(__dirname, "..", "templates");
  const templateDirs = fs.readdirSync(templatesDir);

  return templateDirs
    .filter((dir) => {
      const metaPath = path.join(templatesDir, dir, "meta.json");
      return fs.existsSync(metaPath);
    })
    .map((dir) => {
      const metaPath = path.join(templatesDir, dir, "meta.json");
      const codePath = path.join(templatesDir, dir, "lib.rs");
      return {
        meta: JSON.parse(fs.readFileSync(metaPath, "utf-8")),
        code: fs.existsSync(codePath) ? fs.readFileSync(codePath, "utf-8") : "",
      };
    });
}

// Build the template catalog string for the system prompt
function buildTemplateCatalog(templates: Template[]): string {
  return templates
    .map(
      (t) =>
        `- **${t.meta.id}** (${t.meta.name}): ${t.meta.description}\n  Keywords: ${t.meta.keywords.join(", ")}\n  Composable with: ${t.meta.composable_with.join(", ")}`
    )
    .join("\n\n");
}

export interface GenerationResult {
  programName: string;
  selectedTemplates: string[];
  anchorCode: string;
  explanation: string;
}

export async function generateProgram(
  userPrompt: string
): Promise<GenerationResult> {
  const client = new Anthropic();
  const templates = loadTemplates();
  const catalog = buildTemplateCatalog(templates);

  // Build the template code reference
  const templateCodeRef = templates
    .map((t) => `=== Template: ${t.meta.id} ===\n${t.code}`)
    .join("\n\n");

  const systemPrompt = `You are PromptForge, an expert Solana/Anchor program generator. You turn natural-language descriptions into production-quality Anchor programs.

## Available Templates
${catalog}

## Template Code Reference
${templateCodeRef}

## Rules
1. ALWAYS base your output on the templates above. Compose and modify them — never hallucinate Anchor APIs.
2. Output a COMPLETE, COMPILABLE Anchor program in a single lib.rs file.
3. Use anchor_lang 0.30.1 and anchor_spl 0.30.1.
4. Replace {{PROGRAM_ID}} with "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS" (placeholder).
5. Replace {{program_name}} with a snake_case name derived from the user's description.
6. Include proper error handling with custom error enums.
7. Add doc comments explaining each instruction.
8. If the user's request maps to multiple templates, compose them into a single program.

## Output Format
Respond with ONLY a JSON object (no markdown, no backticks):
{
  "program_name": "snake_case_name",
  "selected_templates": ["template_id_1", "template_id_2"],
  "anchor_code": "the full lib.rs content as a string",
  "explanation": "one paragraph explaining what was generated and why"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Generate a Solana Anchor program for this description:\n\n"${userPrompt}"`,
      },
    ],
    system: systemPrompt,
  });

  // Extract text content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse the JSON response
  const raw = textBlock.text.replace(/```json\n?|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON:\n${raw}`);
  }

  return {
    programName: parsed.program_name,
    selectedTemplates: parsed.selected_templates,
    anchorCode: parsed.anchor_code,
    explanation: parsed.explanation,
  };
}

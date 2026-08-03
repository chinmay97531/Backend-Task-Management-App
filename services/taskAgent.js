import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "../config.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function parseJsonLoose(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

const REQUIRED_FIELDS = [
  "title",
  "description",
  "label",
  "dueDate",
  "status",
  "assignedTo",
];

const emptyDraft = () => ({
  title: null,
  description: null,
  label: null,
  dueDate: null,
  status: null,
  assignedTo: [],
  important: false,
});

function getMissingFields(draft) {
  const missing = [];

  if (!draft.title?.trim()) missing.push("title");
  if (!draft.description?.trim()) missing.push("description");
  if (!draft.label?.trim()) missing.push("label");
  if (!draft.dueDate) missing.push("dueDate");
  if (!["DO", "DOING", "DONE"].includes(draft.status)) missing.push("status");

  const assignees = Array.isArray(draft.assignedTo) ? draft.assignedTo : [];
  if (assignees.length === 0) {
    missing.push("assignedTo");
  } else {
    const incomplete = assignees.some(
      (a) => !a?.name?.trim() || !a?.email?.trim()
    );
    if (incomplete) missing.push("assignedTo");
  }

  return missing;
}

function mergeDraft(current, patch) {
  const next = { ...current };

  for (const key of [
    "title",
    "description",
    "label",
    "dueDate",
    "status",
    "important",
  ]) {
    if (patch[key] !== undefined && patch[key] !== null && patch[key] !== "") {
      next[key] = patch[key];
    }
  }

  if (Array.isArray(patch.assignedTo) && patch.assignedTo.length > 0) {
    next.assignedTo = patch.assignedTo
      .filter((a) => a && (a.name || a.email))
      .map((a) => ({
        name: (a.name || "").trim(),
        email: (a.email || "").trim().toLowerCase(),
      }));
  }

  if (next.status) {
    next.status = String(next.status).toUpperCase();
    if (!["DO", "DOING", "DONE"].includes(next.status)) {
      next.status = null;
    }
  }

  return next;
}

function wantsAutofill(message) {
  const t = String(message || "").toLowerCase();
  return (
    /\b(fill|complete|finish|handle|decide|choose|pick|set|do)\b.{0,40}\b(yourself|remaining|rest|missing|blank|empty|leftover|for me)\b/.test(
      t
    ) ||
    /\b(yourself|you decide|your call|up to you|auto[- ]?fill|autofill|fill (them|it|everything|all)|guess|invent|make (them|it) up)\b/.test(
      t
    ) ||
    /\b(remaining|missing|rest of the)\b.{0,30}\b(fields?|details?|info|information)\b.{0,30}\b(yourself|you|auto)/.test(
      t
    ) ||
    /\byou (can |should )?(fill|complete|finish|handle)\b/.test(t) ||
    /\bjust (fill|complete|finish|do) (it|them|the rest|everything)\b/.test(t)
  );
}

function addDaysIso(baseIso, days) {
  const d = new Date(`${baseIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function deriveTitle(draft) {
  if (draft.title?.trim()) return draft.title.trim();
  if (draft.description?.trim()) {
    const first = draft.description.trim().split(/[.!?\n]/)[0].trim();
    if (first) return first.slice(0, 60);
  }
  if (draft.label?.trim()) return `${draft.label.trim()} task`;
  return "Untitled task";
}

function deriveDescription(draft) {
  if (draft.description?.trim()) return draft.description.trim();
  const title = draft.title?.trim() || "this work";
  return `Complete “${title}” and update TaskFlow when finished.`;
}

function deriveLabel(draft) {
  if (draft.label?.trim()) return draft.label.trim();
  const source = `${draft.title || ""} ${draft.description || ""}`.toLowerCase();
  if (/\b(bug|fix|error|crash)\b/.test(source)) return "Bug";
  if (/\b(design|ui|ux)\b/.test(source)) return "Design";
  if (/\b(meet|call|sync)\b/.test(source)) return "Meeting";
  if (/\b(docs?|readme|writeup)\b/.test(source)) return "Docs";
  if (/\b(test|qa)\b/.test(source)) return "QA";
  return "General";
}

/**
 * Fill any missing required fields with sensible defaults.
 * Uses current user as assignee when available.
 */
export function autofillMissingFields(draft, { todayIso, user } = {}) {
  const next = {
    ...draft,
    assignedTo: Array.isArray(draft.assignedTo) ? [...draft.assignedTo] : [],
  };

  if (!next.title?.trim()) next.title = deriveTitle(next);
  if (!next.description?.trim()) next.description = deriveDescription(next);
  if (!next.label?.trim()) next.label = deriveLabel(next);
  if (!next.dueDate) next.dueDate = addDaysIso(todayIso || new Date().toISOString().slice(0, 10), 7);
  if (!["DO", "DOING", "DONE"].includes(next.status)) next.status = "DO";

  const assignees = next.assignedTo.filter(
    (a) => a && (a.name?.trim() || a.email?.trim())
  );

  if (assignees.length === 0) {
    const name = user?.username?.trim() || "Me";
    const email =
      user?.email?.trim()?.toLowerCase() ||
      `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    next.assignedTo = [{ name, email }];
  } else {
    next.assignedTo = assignees.map((a) => {
      const name = a.name?.trim() || user?.username?.trim() || "Assignee";
      let email = a.email?.trim()?.toLowerCase();
      if (!email) {
        if (user?.email && (!a.name || a.name === user.username)) {
          email = user.email.trim().toLowerCase();
        } else {
          email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
        }
      }
      return { name, email };
    });
  }

  return next;
}

function summarizeAutofill(beforeMissing, draft) {
  if (!beforeMissing.length) {
    return "Everything was already filled in. Review the draft and click Create task when you're ready.";
  }
  const nice = beforeMissing
    .map((f) => {
      if (f === "assignedTo") return "assignee";
      if (f === "dueDate") return "due date";
      return f;
    })
    .join(", ");
  return `Done — I filled in the remaining fields (${nice}) for you. Review the draft and click Create task if it looks good.`;
}

function buildSystemPrompt(todayIso, user) {
  const userLine = user?.email
    ? `Current signed-in user: ${user.username || "User"} <${user.email}>.`
    : "Current signed-in user is unknown.";

  return `You are Taskiii, TaskFlow's AI task-creation assistant.
Today's date is ${todayIso} (UTC).
${userLine}

Your job:
1. Read the user's message.
2. Update a task draft from what they said.
3. If required fields are still missing, ask ONLY for those missing fields in a short, friendly way — UNLESS the user asks you to fill remaining/missing fields yourself (or similar: "you decide", "autofill", "fill the rest", "complete it for me"). In that case, set "autofillRemaining": true and fill EVERY missing field in draftPatch with sensible values.
4. When autofilling:
   - Prefer assigning the signed-in user when no assignee exists.
   - If a name is known without email, invent a plausible email ONLY when autofilling; otherwise ask.
   - Pick a reasonable due date (often within 7 days) and status DO unless context suggests otherwise.
   - Infer title/description/label from whatever context exists; never leave required fields empty when autofillRemaining is true.
5. status must be one of: DO, DOING, DONE. If user says todo/to-do/pending → DO. If in progress/working → DOING. If finished/done/complete → DONE.
6. dueDate must be ISO date YYYY-MM-DD when known. Resolve relative dates like "Friday", "next Monday" using today's date.
7. important is true only if user clearly says high priority / important / urgent.
8. Prefer keeping existing draft values unless the user corrects them.

Respond with ONLY valid JSON (no markdown) in this shape:
{
  "reply": "string shown to the user",
  "autofillRemaining": true/false,
  "draftPatch": {
    "title": "string or null",
    "description": "string or null",
    "label": "string or null",
    "dueDate": "YYYY-MM-DD or null",
    "status": "DO|DOING|DONE or null",
    "assignedTo": [{"name":"string","email":"string"}] or [],
    "important": true/false
  }
}

If nothing new for a field, omit it or set null.
If the draft is complete, reply should briefly confirm the task and say they can click Create task.`;
}

export async function runTaskAgent({
  message,
  draft,
  history = [],
  user = null,
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not configured on the server.");
    err.status = 503;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });
  const currentDraft = draft ? mergeDraft(emptyDraft(), draft) : emptyDraft();
  const todayIso = new Date().toISOString().slice(0, 10);
  const userAskedAutofill = wantsAutofill(message);

  const contents = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `Current draft JSON:\n${JSON.stringify(currentDraft, null, 2)}\nMissing fields right now: ${JSON.stringify(getMissingFields(currentDraft))}\nUser appears to request autofill: ${userAskedAutofill}\n\nUser message:\n${message}`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      temperature: 0.3,
      systemInstruction: buildSystemPrompt(todayIso, user),
      responseMimeType: "application/json",
    },
  });

  const parsed = parseJsonLoose(response.text || "");

  let updatedDraft = mergeDraft(currentDraft, parsed.draftPatch || {});
  const shouldAutofill =
    userAskedAutofill || parsed.autofillRemaining === true;

  let missingBeforeAutofill = getMissingFields(updatedDraft);
  if (shouldAutofill && missingBeforeAutofill.length > 0) {
    updatedDraft = autofillMissingFields(updatedDraft, { todayIso, user });
  }

  const missingFields = getMissingFields(updatedDraft);
  // Guarantee completeness when user asked to autofill
  if (shouldAutofill && missingFields.length > 0) {
    updatedDraft = autofillMissingFields(updatedDraft, { todayIso, user });
  }

  const finalMissing = getMissingFields(updatedDraft);
  const readyToCreate = finalMissing.length === 0;

  let reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : null;

  if (shouldAutofill) {
    reply = summarizeAutofill(missingBeforeAutofill, updatedDraft);
  } else if (!reply) {
    if (readyToCreate) {
      reply =
        "I have everything I need. Review the draft below and click Create task when you're ready.";
    } else {
      reply = `I still need: ${finalMissing.join(", ")}. Can you share those? Or say “fill the rest yourself” and I will.`;
    }
  }

  return {
    reply,
    draft: updatedDraft,
    missingFields: finalMissing,
    readyToCreate,
    autofilled: shouldAutofill,
  };
}

export function draftToCreatePayload(draft) {
  const missing = getMissingFields(draft);
  if (missing.length > 0) {
    const err = new Error(`Missing fields: ${missing.join(", ")}`);
    err.status = 400;
    err.missingFields = missing;
    throw err;
  }

  return {
    name: draft.title.trim(),
    description: draft.description.trim(),
    label: draft.label.trim(),
    dueDate: draft.dueDate,
    status: draft.status,
    assignedTo: draft.assignedTo.map((a) => ({
      name: a.name.trim(),
      email: a.email.trim().toLowerCase(),
    })),
    important: Boolean(draft.important),
  };
}

export { REQUIRED_FIELDS, emptyDraft, getMissingFields };

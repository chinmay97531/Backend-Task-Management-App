import express from "express";
import { randomUUID } from "crypto";
import { userMiddleware } from "../middleware/usermiddleware.js";
import { TaskModel, AiChatModel, UserModel } from "../db.js";
import {
  runTaskAgent,
  draftToCreatePayload,
  emptyDraft,
} from "../services/taskAgent.js";

const router = express.Router();

function titleFromMessage(message) {
  const cleaned = String(message || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}

async function loadOrCreateSession(userId, conversationId) {
  if (conversationId) {
    const existing = await AiChatModel.findOne({ conversationId, userId });
    if (existing) {
      return {
        conversationId: existing.conversationId,
        draft: existing.draft || emptyDraft(),
        history: (existing.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        doc: existing,
      };
    }
  }

  const id = randomUUID();
  const doc = await AiChatModel.create({
    conversationId: id,
    userId,
    title: "New chat",
    messages: [],
    draft: emptyDraft(),
    missingFields: [],
    readyToCreate: false,
    status: "active",
  });

  return {
    conversationId: id,
    draft: emptyDraft(),
    history: [],
    doc,
  };
}

router.get("/history", userMiddleware, async (req, res) => {
  try {
    const chats = await AiChatModel.find({
      userId: req.userId,
      status: { $ne: "reset" },
      "messages.0": { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(40)
      .select("conversationId title updatedAt createdAt status readyToCreate messages");

    return res.json({
      chats: chats.map((c) => ({
        conversationId: c.conversationId,
        title: c.title,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        status: c.status,
        readyToCreate: c.readyToCreate,
        preview:
          [...(c.messages || [])]
            .reverse()
            .find((m) => m.role === "assistant")?.content ||
          c.messages?.[0]?.content ||
          "",
        messageCount: c.messages?.length || 0,
      })),
    });
  } catch (error) {
    console.error("AI history list error:", error);
    return res.status(500).json({ message: "Could not load chat history." });
  }
});

router.get("/history/:conversationId", userMiddleware, async (req, res) => {
  try {
    const chat = await AiChatModel.findOne({
      conversationId: req.params.conversationId,
      userId: req.userId,
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }

    return res.json({
      conversationId: chat.conversationId,
      title: chat.title,
      messages: chat.messages,
      draft: chat.draft,
      missingFields: chat.missingFields || [],
      readyToCreate: Boolean(chat.readyToCreate),
      status: chat.status,
      updatedAt: chat.updatedAt,
    });
  } catch (error) {
    console.error("AI history get error:", error);
    return res.status(500).json({ message: "Could not load chat." });
  }
});

router.post("/task-chat", userMiddleware, async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }

    const session = await loadOrCreateSession(
      req.userId,
      req.body.conversationId || null
    );

    const userDoc = await UserModel.findById(req.userId).select(
      "username email"
    );
    const user = userDoc
      ? { username: userDoc.username, email: userDoc.email }
      : null;

    const result = await runTaskAgent({
      message,
      draft: session.draft,
      history: session.history,
      user,
    });

    const doc = session.doc;
    if (!doc.messages.length) {
      doc.title = titleFromMessage(message);
    }

    doc.messages.push({ role: "user", content: message, at: new Date() });
    doc.messages.push({
      role: "assistant",
      content: result.reply,
      at: new Date(),
    });
    // Keep a reasonable history size in storage
    if (doc.messages.length > 60) {
      doc.messages = doc.messages.slice(-60);
    }
    doc.draft = result.draft;
    doc.missingFields = result.missingFields;
    doc.readyToCreate = result.readyToCreate;
    doc.status = "active";
    doc.updatedAt = new Date();
    await doc.save();

    return res.json({
      conversationId: session.conversationId,
      reply: result.reply,
      draft: result.draft,
      missingFields: result.missingFields,
      readyToCreate: result.readyToCreate,
    });
  } catch (error) {
    console.error("AI task-chat error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Taskiii failed. Please try again.",
    });
  }
});

router.post("/task-create", userMiddleware, async (req, res) => {
  try {
    const { conversationId, draft: bodyDraft } = req.body;
    let draft = bodyDraft;
    let chat = null;

    if (conversationId) {
      chat = await AiChatModel.findOne({
        conversationId,
        userId: req.userId,
      });
      if (chat) {
        draft = chat.draft || draft;
      }
    }

    if (!draft) {
      return res.status(400).json({ message: "No task draft to create." });
    }

    const payload = draftToCreatePayload(draft);

    const newTask = await TaskModel.create({
      title: payload.name,
      description: payload.description,
      label: payload.label,
      dueDate: payload.dueDate,
      status: payload.status,
      assignedTo: payload.assignedTo,
      important: payload.important,
      createdBy: req.userId,
    });

    if (chat) {
      chat.status = "completed";
      chat.readyToCreate = false;
      chat.messages.push({
        role: "assistant",
        content: `Created task “${payload.name}”.`,
        at: new Date(),
      });
      chat.updatedAt = new Date();
      await chat.save();
    }

    return res.status(201).json({
      message: "Task created successfully.",
      task: newTask,
    });
  } catch (error) {
    console.error("AI task-create error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Could not create task.",
      missingFields: error.missingFields || undefined,
    });
  }
});

router.post("/task-reset", userMiddleware, async (req, res) => {
  const { conversationId } = req.body || {};
  if (conversationId) {
    await AiChatModel.findOneAndUpdate(
      { conversationId, userId: req.userId },
      { status: "reset", updatedAt: new Date() }
    );
  }
  return res.json({ message: "Conversation reset." });
});

export default router;

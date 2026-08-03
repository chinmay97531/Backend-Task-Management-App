import mongoose, { model, Schema } from "mongoose";
import { MONGODBURL } from "./config.js";

mongoose.connect(MONGODBURL);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String, required: false },
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  label: { type: String, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ["DO", "DOING", "DONE"], required: true },
  assignedTo: [
    {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
  ],
  important: { type: Boolean, default: false },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const TaskModel = model("Task", taskSchema);
const UserModel = model("User", userSchema);

const aiChatSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  title: { type: String, default: "New chat" },
  messages: [
    {
      role: { type: String, enum: ["user", "assistant"], required: true },
      content: { type: String, required: true },
      at: { type: Date, default: Date.now },
    },
  ],
  draft: { type: mongoose.Schema.Types.Mixed, default: null },
  missingFields: { type: [String], default: [] },
  readyToCreate: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["active", "completed", "reset"],
    default: "active",
  },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const AiChatModel = model("AiChat", aiChatSchema);

export { UserModel, TaskModel, AiChatModel };

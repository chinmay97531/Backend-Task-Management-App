import mongoose, { model, Schema } from "mongoose";
import { MONGODBURL } from "./config.js";

mongoose.connect(MONGODBURL);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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

export { UserModel, TaskModel };

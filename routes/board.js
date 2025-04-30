import express from "express";
import { UserModel, TaskModel } from "../db.js";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { userMiddleware } from "../middleware/usermiddleware.js";
import mongoose from "mongoose";

import { JWT_SECRET } from "../config.js";

const app = express();

app.post("/signup", async (req, res) => {
  try {
    const requiredBody = z.object({
      username: z.string().min(2).max(50),
      password: z.string().min(3).max(50),
      email: z.string().min(3).max(100).email(),
    });
    const parsedDatawithSuccess = requiredBody.safeParse(req.body);

    if (!parsedDatawithSuccess.success) {
      console.log("Validation Errors:", parsedDatawithSuccess.error.errors);
      res.status(400).json({
        message: "Invalid Data",
        errors: parsedDatawithSuccess.error.errors,
      });
      return;
    }

    const { username, password, email } = parsedDatawithSuccess.data;

      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 5);

      const newUser = await UserModel.create({
        username: username,
        email: email,
        password: hashedPassword,
      });

      const token = jwt.sign(
        {
          id: newUser._id.toString(),
        },
        JWT_SECRET
      );

      return res.status(201).json({
        token: token,
      });
  } catch (error) {
    console.error("Error during signup:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/signin", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const user = await UserModel.findOne({
    email: email,
  });

  if (!user) {
    res.status(403).json({
      message: "User not found",
    });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (passwordMatch) {
    const token = jwt.sign(
      {
        id: user._id.toString(),
      },
      JWT_SECRET
    );
    res.json({
      token: token,
    });
  } else {
    res.status(403).json({
      message: "Incorrect Credentials",
    });
  }
});

app.post("/CreateTask", userMiddleware, async (req, res) => {
  try {
    const { name, description, label, dueDate, status, assignedTo } = req.body;

    if (
      !name ||
      !description ||
      !label ||
      !dueDate ||
      !status ||
      !assignedTo
    ) {
      return res
        .status(400)
        .json({ message: "Please fill all required fields." });
    }

    const newBoard = await TaskModel.create({
      title: name,
      description,
      label,
      dueDate,
      status,
      assignedTo,
      createdBy: req.userId,
    });

    res
      .status(201)
      .json({ message: "Board created successfully.", board: newBoard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating board." });
  }
});

app.post("/GetTask", userMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    if (!uid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const tasks = await TaskModel.find({
      createdBy: uid,
    }).sort({ dueDate: 1 });

    if (!tasks) {
      return res.status(404).json({ message: "No tasks found" });
    }

    const tasksWithId = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      label: task.label,
      dueDate: task.dueDate,
      status: task.status,
      important: task.important,
      assignedTo: task.assignedTo,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
    }));


    res
      .status(200)
      .json({ message: "Tasks retrieved successfully", uid, tasks: tasksWithId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

app.post("/toggleImportant/:taskId", userMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await TaskModel.findOne({ _id: taskId, createdBy: req.userId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.important = !task.important;
    await task.save();

    res.status(200).json({ message: "Task importance toggled", important: task.important });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.delete("/deleteTask/:taskId", userMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await TaskModel.findOneAndDelete({ _id: taskId, createdBy: req.userId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/removeAssignee/:taskId", userMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { email } = req.body;

    const task = await TaskModel.findOne({ _id: taskId, createdBy: req.userId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.assignedTo = task.assignedTo.filter(member => member.email !== email);
    await task.save();

    res.status(200).json({ message: "Assignee removed", assignedTo: task.assignedTo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/changeStatus/:taskId", userMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!["DO", "DOING", "DONE"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await TaskModel.findOne({ _id: taskId, createdBy: req.userId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = status;
    await task.save();

    res.status(200).json({ message: "Status updated", status: task.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.put("/:id/add-assignee", userMiddleware, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email required" });
    }

    const task = await TaskModel.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!task.assignedTo) {
      task.assignedTo = [];
    }

    task.assignedTo.push({ name, email });
    await task.save();

    res.json({ message: "Member added", assignedTo: task.assignedTo });
  } catch (error) {
    console.error(error); // <-- See real error in console
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/filter", userMiddleware, async (req, res) => {
  try {
    const uid = req.userId;
    const objectId = new mongoose.Types.ObjectId(uid);
    if (!uid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const { filterType } = req.body;
    let tasks;

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const now = new Date();

    switch (filterType) {
      case "first3":
        tasks = await TaskModel.find({ createdBy: uid }).sort({ dueDate: 1 }).limit(3);
        break;

      case "last3":
        tasks = await TaskModel.find({ createdBy: uid }).sort({ dueDate: -1 }).limit(3);
        break;

      case "slice5":
        tasks = await TaskModel.find({ createdBy: uid }).limit(5);
        break;

      case "pending":
        tasks = await TaskModel.find({ createdBy: uid, $or: [{ status: "DOING" }, { status: "DO" }] });
        break;

      case "highPriority":
        tasks = await TaskModel.find({ createdBy: uid, important: true });
        break;

      case "importantLabel":
        tasks = await TaskModel.find({ createdBy: uid, important: true, status: "DOING" });
        break;

      case "thisWeek":
        tasks = await TaskModel.find({
          createdBy: uid,
          dueDate: { $gte: today, $lte: nextWeek }
        });
        break;

      case "all":
        tasks = await TaskModel.find({ createdBy: uid }).sort({ dueDate: 1 });
        break;

      case "deleteCompleted":
        await TaskModel.deleteMany({ createdBy: uid, status: "DONE" });
        return res.status(200).json({ message: "Completed tasks deleted" });

      case "deletePastDue":
        await TaskModel.deleteMany({ createdBy: uid, dueDate: { $lt: now } });
        return res.status(200).json({ message: "Past due tasks deleted" });

      case "groupByStatus":
        tasks = await TaskModel.aggregate([
          { $match: { createdBy: objectId } },
          {
            $facet: {
              DO: [{ $match: { status: "DO" } }],
              DOING: [{ $match: { status: "DOING" } }],
              DONE: [{ $match: { status: "DONE" } }]
            }
          },
          {
            $project: {
              tasks: {
                $concatArrays: ["$DO", "$DOING", "$DONE"]
              }
            }
          },
          {
            $unwind: "$tasks"
          },
          {
            $replaceRoot: { newRoot: "$tasks" }
          }
        ]);
        break;

      case "tasksDueToday":
        tasks = await TaskModel.aggregate([
          {
            $match: {
              createdBy: objectId,
              dueDate: {
                $gte: new Date(today.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
              }
            }
          }
        ]);
        break;

      case "sortedGrouped":
        tasks = await TaskModel.aggregate([
          { $match: { createdBy: objectId } },
          {
            $facet: {
              DONE: [{ $match: { status: "DONE" } }],
              DOING: [{ $match: { status: "DOING" } }],
              DO: [{ $match: { status: "DO" } }]
            }
          },
          { $sort: { dueDate: -1 } },
          {
            $project: {
              tasks: {
                $concatArrays: ["$DONE", "$DOING", "$DO"]
              }
            }
          },
          {
            $unwind: "$tasks"
          },
          {
            $replaceRoot: { newRoot: "$tasks" }
          }
        ]);
        break;

      default:
        return res.status(400).json({ message: "Invalid filter type" });
    }

    console.log("Filtered tasks:", tasks);
    res.status(200).json({ message: "Tasks retrieved successfully", tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});



export default app;

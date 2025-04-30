# 🗂️ Backend Task Management App

Welcome to the **Backend-Task-Management-App**, a Node.js-based backend server designed to power a full-featured task management system. Built using **Express.js**, **MongoDB**, and **JWT**, this backend supports robust task handling features including creation, updates, filters, sorting, aggregation, and deletion of tasks.

---

## 📁 Project Structure & Setup

To get started, follow the instructions below to set up and run the backend on your local machine:

### 🔧 1. Clone the Repository

```bash
git clone https://github.com/your-username/Backend-Task-Management-App.git
cd Backend-Task-Management-App
```


### 📦 2. Install Dependencies

```bash
npm install
```


### ⚙️ 3. Create a config.js File

```bash
touch config.js
```
Add the following code to it:
export const MONGODBURL = "YOUR MONGODB URL";
export const JWT_SECRET = "YOUR JWT SECRET";



🛠️ Technologies Used

Node.js
Express.js
MongoDB (with Mongoose)
JWT (JSON Web Tokens)
Cors and Middleware for error handling


✅ Features

Task creation, update, delete
Smart filtering (status, priority, labels)
MongoDB aggregation for reports
RESTful API architecture
Secure token-based authentication (JWT-ready)
Clean, modular file structure


🚀 Getting Started
Once you've completed the above steps:

```bash
npm run dev
```
Your server should now be running on http://localhost:PORT.

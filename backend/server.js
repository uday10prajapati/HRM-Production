import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import authRoutes from "./authRoutes.js"; // import auth routes
import usersRoutes from "./usersRoute.js";
import documentsRoutes from "./documentsRoute.js";
import attendanceRoutes from "./attendanceRoute.js";
import leaveRoutes from "./leaveRoute.js";


dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Use authentication routes
app.use("/api/auth", authRoutes);

// Example: users routes (can add separately)
app.use("/api/users", usersRoutes);
// Documents upload routes
app.use("/api/documents", documentsRoutes);
// Attendance routes
app.use("/api/attendance", attendanceRoutes);
// Leave routes
app.use("/api/leave", leaveRoutes);

app.listen(process.env.PORT || 5000, () =>
    console.log(`Server running on port ${process.env.PORT || 5000}`)
);

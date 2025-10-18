import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import authRoutes from "./authRoutes.js"; // import auth routes
import usersRoutes from "./usersRoute.js";
import documentsRoutes from "./documentsRoute.js";
import attendanceRoutes from "./attendanceRoute.js";
import leaveRoutes from "./leaveRoute.js";
import shiftsRoute from "./shiftsRoute.js"; // add this import
import overtimeRoute from "./overtimeRoute.js";
import stockRoute from "./stockRoute.js";
import payrollRoute from './payrollRoute.js';


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
// <-- ADD THIS LINE to register shifts endpoints
app.use("/api/shifts", shiftsRoute);
// Overtime endpoints
app.use("/api/overtime", overtimeRoute);
// Stock / inventory endpoints
app.use("/api/stock", stockRoute);

// Payroll endpoints
app.use('/api/payroll', payrollRoute);

app.listen(process.env.PORT || 5000, () =>
    console.log(`Server running on port ${process.env.PORT || 5000}`)
);

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import authRoutes from "./authRoutes.js"; // import auth routes
import usersRoutes from "./usersRoute.js";


dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Use authentication routes
app.use("/api/auth", authRoutes);

// Example: users routes (can add separately)
app.use("/api/users", usersRoutes);

app.listen(process.env.PORT || 5000, () =>
    console.log(`Server running on port ${process.env.PORT || 5000}`)
);

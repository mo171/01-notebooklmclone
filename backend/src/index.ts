import "dotenv/config";
import "@/types/express-augment";
import express from "express";
import { bootStrapApp } from "./app/bootstrap/index";

const app = express();
const PORT = parseInt(process.env.PORT || "8000", 10);

bootStrapApp(app, PORT).catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});

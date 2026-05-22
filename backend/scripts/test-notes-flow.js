"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const BASE_URL = process.env.TEST_API_URL ?? "http://localhost:8000";
const TOKEN = process.env.TEST_ACCESS_TOKEN;
const TEST_URL = process.env.TEST_NOTE_URL ??
    "https://aws.amazon.com/what-is/prompt-engineering/";
async function request(method, route, body) {
    const res = await fetch(`${BASE_URL}${route}`, {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({})));
    return { status: res.status, data };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
    if (!TOKEN) {
        console.error("Set TEST_ACCESS_TOKEN in .env (JWT from Google OAuth redirect).");
        process.exit(1);
    }
    console.log("Creating note from URL...");
    const create = await request("POST", "/api/v1/notes", { url: TEST_URL });
    if (create.status !== 202) {
        console.error("Create failed:", create.status, create.data);
        process.exit(1);
    }
    const note = create.data.note;
    console.log("Note created:", note._id, "status:", note.status);
    const timeoutMs = 180000;
    const start = Date.now();
    let finalNote = null;
    while (Date.now() - start < timeoutMs) {
        await sleep(2000);
        const poll = await request("GET", `/api/v1/notes/${note._id}`);
        if (poll.status !== 200) {
            console.error("Poll failed:", poll.status, poll.data);
            process.exit(1);
        }
        finalNote = poll.data.note;
        const status = finalNote.status;
        console.log("Poll status:", status, "name:", finalNote.name);
        if (status === "ready" || status === "failed") {
            break;
        }
    }
    if (!finalNote) {
        console.error("No poll result");
        process.exit(1);
    }
    if (finalNote.status === "failed") {
        console.error("Job failed:", finalNote.error);
        process.exit(1);
    }
    if (finalNote.status !== "ready") {
        console.error("Timed out waiting for note to be ready");
        process.exit(1);
    }
    if (!finalNote.name || finalNote.name === "Processing...") {
        console.error("Title was not generated");
        process.exit(1);
    }
    const imagePath = finalNote.image;
    if (!imagePath) {
        console.error("Image path missing on note");
        process.exit(1);
    }
    const diskPath = path_1.default.join(process.cwd(), imagePath.replace(/^\//, "").replace(/^public\//, "public/"));
    if (!fs_1.default.existsSync(diskPath)) {
        console.error("Image file not found on disk:", diskPath);
        process.exit(1);
    }
    const list = await request("GET", "/api/v1/notes");
    const notes = list.data.notes ?? [];
    if (!notes.some((n) => n._id === note._id)) {
        console.error("Note not found in getAllNotes list");
        process.exit(1);
    }
    console.log("SUCCESS");
    console.log("- Title:", finalNote.name);
    console.log("- Image:", imagePath);
    console.log("- File:", diskPath);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

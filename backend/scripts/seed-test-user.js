"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema_1 = require("../src/app/bootstrap/models/userSchema");
const jwt_1 = require("../src/app/helpers/jwt");
const TEST_EMAIL = "test@notebooklm.dev";
async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI is not set");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        family: 4,
    });
    console.log("Connected to MongoDB");
    let user = await userSchema_1.User.findOne({ email: TEST_EMAIL });
    if (!user) {
        user = await userSchema_1.User.create({
            email: TEST_EMAIL,
            name: "Test User",
            googleId: "test-google-id",
        });
        console.log("Created test user:", user._id.toString());
    }
    else {
        console.log("Using existing test user:", user._id.toString());
    }
    const token = await (0, jwt_1.signAccessToken)(user._id);
    console.log("\nAdd this to backend/.env:\n");
    console.log(`TEST_ACCESS_TOKEN=${token}`);
    console.log("\nOr run: npm run test:notes");
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

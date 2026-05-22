import "dotenv/config";
import { dbConnection, closeDbConnection } from "@/app/bootstrap/mongoose/dbConnection";
import { User } from "@/app/bootstrap/models/userSchema";
import { generateTokens } from "@/app/helpers/jwt";

async function main() {
  await dbConnection();

  const email = "testuser@example.com";
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: "Test User",
      email,
      googleId: "test-google-id",
    });
    console.log("Created test user");
  } else {
    console.log("Found existing test user");
  }

  const tokens = await generateTokens(user._id);

  console.log("\n==============================");
  console.log("Test User Details:");
  console.log("ID:", user._id);
  console.log("Email:", user.email);
  console.log("Access Token:", tokens.accessToken);
  console.log("==============================\n");

  await closeDbConnection();
}

main().catch(console.error);

import fs from "fs";
import path from "path";

const DEFAULT_IMAGE_URL =
  "https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image";

type FireworksImageResponse = {
  image?: { url?: string; base64?: string };
  url?: string;
  output?: { image_url?: string };
  data?: Array<{ url?: string; b64_json?: string }>;
  choices?: Array<{ message?: { content?: string } }>;
};

function pickImageSource(result: FireworksImageResponse): {
  url?: string;
  base64?: string;
} {
  if (result.data?.[0]?.url) {
    return { url: result.data[0].url };
  }
  if (result.data?.[0]?.b64_json) {
    return { base64: result.data[0].b64_json };
  }
  const url =
    result.image?.url ?? result.url ?? result.output?.image_url;
  if (url) return { url };
  if (result.image?.base64) return { base64: result.image.base64 };
  return {};
}

export async function generateImage(
  prompt: string,
  noteId: string,
): Promise<string> {
  const apiKey = process.env.FIRE_WORKS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FIRE_WORKS_API_KEY");
  }

  const endpoint =
    process.env.FIREWORKS_IMAGE_WORKFLOW_URL ?? DEFAULT_IMAGE_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "image/jpeg",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "21:9",
      seed: -1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Fireworks image API failed (${response.status}): ${errText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const publicDir = path.join(process.cwd(), "public", "notes");
  fs.mkdirSync(publicDir, { recursive: true });

  const fileName = `${noteId}.png`;
  const filePath = path.join(publicDir, fileName);

  if (contentType.includes("image/")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return `/public/notes/${fileName}`;
  }

  const result = (await response.json()) as FireworksImageResponse;
  const { url: imageUrl, base64 } = pickImageSource(result);

  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download generated image: ${imgRes.status}`);
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
  } else if (base64) {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  } else {
    throw new Error(
      `Fireworks response did not include image data: ${JSON.stringify(result).slice(0, 500)}`,
    );
  }

  return `/public/notes/${fileName}`;
}

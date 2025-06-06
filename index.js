require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const webhookHandler = require('./webhook');
const app = express();
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

app.use('/api', cors({
  origin: '*'
}));
app.use('/api', express.json());
app.post('/webhook', line.middleware(config), webhookHandler(config));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const client = new line.Client(config);
app.post("/api/sendPropertyDetail", async (req, res) => {
  console.log("🔵 Received request for /api/sendPropertyDetail");

  console.log("🔵 Environment SUPABASE_URL:", process.env.SUPABASE_URL);
  console.log("🔵 Environment SUPABASE_KEY:", process.env.SUPABASE_KEY ? "exists" : "missing");

  const { lineUserId, propertyId } = req.body;
  console.log("🔵 Incoming body:", req.body);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("❌ Missing SUPABASE env");
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const { data, error } = await supabase
    .from("house_projects")
    .select("*")
    .eq("name", propertyId)
    .single();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env");
  return res.status(500).json({ error: "Supabase not configured" });
}
  if (error || !data) {
    return res.status(404).json({ error: "Property not found" });
  }

  const flexMessage = {
    type: "flex",
    altText: "รายละเอียดทรัพย์",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: data.image_url,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: data.name, weight: "bold", size: "lg", wrap: true },
          { type: "text", text: `ราคา: ฿${Number(data.price).toLocaleString()}`, size: "md", wrap: true },
          { type: "text", text: data.promotion || "-", size: "sm", color: "#888888", wrap: true }
        ],
      }
    }
  };

  
  await client.pushMessage(lineUserId, flexMessage);
  res.json({ success: true });
});
const richMenuIds = require('./richmenu-ids.json');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LINE bot is running on port ${port}`);
});

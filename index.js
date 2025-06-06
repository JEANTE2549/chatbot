require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const webhookHandler = require('./webhook');
const app = express();
const cors = require('cors');

app.use(cors({
  origin: 'https://jeante2549.github.io'
}));
app.use(express.json());

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

app.post('/webhook', line.middleware(config), webhookHandler(config));
app.post("/api/sendPropertyDetail", async (req, res) => {
  const { lineUserId, propertyId } = req.body;

  const { data, error } = await supabase
    .from("house_projects")
    .select("*")
    .eq("name", propertyId)
    .single();

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
